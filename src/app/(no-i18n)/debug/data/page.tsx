import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  bookingsRepo,
  connectionsRepo,
  pagesRepo,
  subscriptionsRepo,
  tableCounts,
  tenantCountrySettingsRepo,
  tenantsRepo,
  usersRepo,
} from '@/lib/data';
import {
  assertProviderAvailable,
  bookingInsertSchema,
  canTenantGoLive,
  checkBookingAvailability,
  getRequiredConnectionsForTenant,
  tenantInsertSchema,
  ValidationError,
} from '@/lib/validation';
import { computeChecklistProgress } from '@/lib/checklist';
import { decrypt, encrypt, EncryptionError } from '@/lib/vault';
import { mediaRepo, tokenAccessLogRepo } from '@/lib/data';
import { getActiveProvider, uploadMedia, StorageError } from '@/lib/storage';
import {
  ConnectorError,
  getAllConnectors,
  getConnector,
  mockApiKeyConnector,
  submitApiKeyCredentials,
} from '@/lib/connectors';
import { resolveTenant, type TenantResolutionResult } from '@/lib/tenant';
import { getCurrentUser } from '@/lib/auth';
import {
  countries,
  getAllProviders,
  getProvidersForCountry,
  type CountryCode,
  type CountryConfig,
  type ProviderCategory,
  type ProviderEntry,
} from '@/lib/countries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default async function DebugDataPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const [tenants, users, plans, bookings, counts] = await Promise.all([
    tenantsRepo.list(),
    usersRepo.list(),
    subscriptionsRepo.listPlans(),
    Promise.all((await tenantsRepo.list()).map((t) => bookingsRepo.listByTenant(t.id))).then(
      (arrs) => arrs.flat()
    ),
    tableCounts(),
  ]);

  const pages = (
    await Promise.all((await tenantsRepo.list()).map((t) => pagesRepo.listByTenant(t.id)))
  ).flat();

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-12 sm:px-8 lg:px-12">
      <header className="mb-12 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            /debug/data
          </Badge>
          <Badge variant="secondary" className="font-mono">
            Developer-only · mock data preview
          </Badge>
        </div>
        <h1 className="text-display-lg font-bold tracking-tight">Mock data preview</h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          In-memory store loaded from the JSON seed files. This route is hidden in production builds
          (returns 404) and never indexed.
        </p>
      </header>

      <section className="mb-16 space-y-6">
        <div>
          <h2 className="text-display-md font-semibold tracking-tight">Row counts</h2>
          <Separator className="mt-3" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(counts).map(([name, count]) => (
            <Card key={name} size="sm">
              <CardHeader>
                <CardTitle className="font-mono text-xs">{name}</CardTitle>
                <CardDescription className="text-foreground text-3xl font-semibold">
                  {count}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <PreviewSection
        title="Tenants"
        rows={tenants}
        emptyHint="Add seeds to mock/seeds/tenants.json"
      />
      <PreviewSection title="Users" rows={users} emptyHint="No users seeded" />
      <PreviewSection title="Subscription plans" rows={plans} emptyHint="No plans seeded" />
      <PreviewSection title="Pages" rows={pages} emptyHint="No pages seeded" />
      <PreviewSection title="Bookings" rows={bookings} emptyHint="No bookings seeded" />

      <ValidationPlayground />

      <TenantResolutionPlayground />

      <CountriesAndProviders />

      <ConnectionsPlayground />

      <ChecklistPlayground />

      <VaultPlayground />

      <StoragePlayground />

      <ConnectorFrameworkPlayground />

      <AuthPlayground />
    </main>
  );
}

async function ConnectionsPlayground() {
  const tenants = await tenantsRepo.list();
  const tenantSnapshots = await Promise.all(
    tenants.map(async (t) => {
      const [connections, settings, goLive, required] = await Promise.all([
        connectionsRepo.listByTenant(t.id),
        tenantCountrySettingsRepo.findByTenant(t.id),
        canTenantGoLive(t.id),
        getRequiredConnectionsForTenant(t.id),
      ]);
      return { tenant: t, connections, settings, goLive, required };
    })
  );

  return (
    <section className="mb-16 space-y-4" data-testid="connections-playground">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">Connections playground</h2>
        <Separator className="mt-3" />
      </div>
      <p className="text-muted-foreground text-sm">
        Live calls to <code className="font-mono">canTenantGoLive()</code> and{' '}
        <code className="font-mono">getRequiredConnectionsForTenant()</code> against the seeded
        provider connections and country settings.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {tenantSnapshots.map(({ tenant, connections, settings, goLive, required }) => (
          <Card key={tenant.id} size="sm" data-testid={`connections-snapshot-${tenant.slug}`}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge
                  variant={goLive.canGoLive ? 'secondary' : 'destructive'}
                  className="font-mono"
                >
                  {goLive.canGoLive ? '✓ canGoLive' : '⚠ blocked'}
                </Badge>
                <CardTitle className="text-sm">{tenant.name}</CardTitle>
              </div>
              <CardDescription className="font-mono text-xs">
                {tenant.country} · {tenant.slug} · settings:{' '}
                {settings ? settings.legal_entity_name : '(none)'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="text-muted-foreground font-mono uppercase">required</p>
              <ul className="ml-4 list-disc space-y-0.5 font-mono">
                {required.required.length === 0 ? (
                  <li className="text-muted-foreground">(none for this country)</li>
                ) : (
                  required.required.map((r) => (
                    <li key={r.category}>
                      {r.category}{' '}
                      <span className={r.isConfigured ? 'text-foreground' : 'text-destructive'}>
                        ({r.isConfigured ? 'configured' : 'missing'})
                      </span>
                    </li>
                  ))
                )}
              </ul>
              <p className="text-muted-foreground mt-3 font-mono uppercase">connections</p>
              <ul className="ml-4 list-disc space-y-0.5 font-mono">
                {connections.length === 0 ? (
                  <li className="text-muted-foreground">(none)</li>
                ) : (
                  connections.map((c) => (
                    <li key={c.id}>
                      {c.category}/{c.provider}{' '}
                      <span className="text-muted-foreground">({c.status})</span>
                    </li>
                  ))
                )}
              </ul>
              {goLive.reasons.length > 0 && (
                <>
                  <p className="text-muted-foreground mt-3 font-mono uppercase">reasons</p>
                  <ul className="ml-4 list-disc space-y-0.5 text-[11px]">
                    {goLive.reasons.map((r, i) => (
                      <li key={i} className="font-mono">
                        {r.defaultMessage}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

const PROVIDER_CATEGORIES: ProviderCategory[] = [
  'accounting',
  'payments',
  'phone',
  'crm',
  'newsletter',
];

function CountriesAndProviders() {
  const allProviders = getAllProviders();
  const countryEntries = Object.values(countries) as CountryConfig[];

  const providerCheck = runProviderRuleExamples();

  return (
    <section className="mb-16 space-y-4" data-testid="countries-and-providers">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">Countries & providers</h2>
        <Separator className="mt-3" />
      </div>
      <p className="text-muted-foreground text-sm">
        Static registry from <code className="font-mono">@/lib/countries</code> — every country
        config lists curated provider ids per category, every provider lists which countries it
        supports. The validation rule below uses the same data.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {countryEntries.map((c) => (
          <Card key={c.code} size="sm" data-testid={`country-card-${c.code}`}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {c.flagEmoji} {c.code}
                </Badge>
                <CardTitle className="text-sm">{c.name.en}</CardTitle>
              </div>
              <CardDescription className="font-mono text-xs">
                {c.defaultCurrency} · {c.timezone} · {c.taxIdentifier.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {PROVIDER_CATEGORIES.map((cat) => {
                const items = getProvidersForCountry(c.code, cat);
                return (
                  <div key={cat}>
                    <p className="text-muted-foreground font-mono uppercase">{cat}</p>
                    {items.length === 0 ? (
                      <p className="text-muted-foreground">—</p>
                    ) : (
                      <ul className="ml-4 list-disc space-y-0.5">
                        {items.map((p) => (
                          <li key={p.id}>
                            <span className="font-mono">{p.name}</span>{' '}
                            <span className="text-muted-foreground">
                              ({p.authMethod}, {p.setupComplexity})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {c.legalRequirements.length > 0 && (
                <div>
                  <p className="text-muted-foreground font-mono uppercase">legal</p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    {c.legalRequirements.map((r, i) => (
                      <li key={i}>
                        <span className="font-mono">{r.category}</span>{' '}
                        <span
                          className={
                            r.requiredAtLaunch ? 'text-foreground' : 'text-muted-foreground'
                          }
                        >
                          ({r.requiredAtLaunch ? 'required at launch' : 'recommended'})
                        </span>{' '}
                        — {r.description.en}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="font-mono text-sm tracking-wider uppercase">All providers</h3>
        <Separator className="mt-2" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allProviders.map((p: ProviderEntry) => (
          <Card key={p.id} size="sm">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {p.category}
                </Badge>
                <CardTitle className="text-sm">{p.name}</CardTitle>
              </div>
              <CardDescription className="font-mono text-xs">
                {p.id} · {p.authMethod} · {p.setupComplexity}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <p>{p.description.en}</p>
              <p className="font-mono">
                <span className="text-muted-foreground">availableIn </span>
                {p.availableIn.join(', ')}
              </p>
              <p className="font-mono">
                <span className="text-muted-foreground">recommendedFor </span>
                {p.recommendedFor.join(', ') || '—'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="font-mono text-sm tracking-wider uppercase">assertProviderAvailable rule</h3>
        <Separator className="mt-2" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {providerCheck.map((ex) => (
          <Card key={ex.title} size="sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant={ex.ok ? 'secondary' : 'destructive'} className="font-mono">
                  {ex.ok ? '✅ ok' : '❌ rejected'}
                </Badge>
                <CardTitle className="text-sm">{ex.title}</CardTitle>
              </div>
              <CardDescription className="text-xs">{ex.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs">
              <p className="font-mono">{ex.outcome}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

type ProviderRuleExample = {
  title: string;
  description: string;
  ok: boolean;
  outcome: string;
};

function runProviderRuleExamples(): ProviderRuleExample[] {
  const cases: Array<{
    title: string;
    description: string;
    expectOk: boolean;
    providerId: string;
    countryCode: CountryCode;
  }> = [
    {
      title: 'Mollie + NL',
      description: 'mollie listed for NL — should pass',
      expectOk: true,
      providerId: 'mollie',
      countryCode: 'NL',
    },
    {
      title: 'Mollie + CW',
      description: 'mollie not listed for CW — should reject',
      expectOk: false,
      providerId: 'mollie',
      countryCode: 'CW',
    },
    {
      title: 'Telnyx + CW',
      description: 'telnyx specifically supports +599 numbers',
      expectOk: true,
      providerId: 'telnyx',
      countryCode: 'CW',
    },
  ];

  return cases.map((c) => {
    try {
      assertProviderAvailable(c.providerId, c.countryCode);
      return {
        title: c.title,
        description: c.description,
        ok: true,
        outcome: c.expectOk ? 'Allowed as expected' : 'Unexpectedly allowed',
      };
    } catch (err) {
      return {
        title: c.title,
        description: c.description,
        ok: false,
        outcome: err instanceof ValidationError ? err.message : 'Unexpected error',
      };
    }
  });
}

async function ChecklistPlayground() {
  const tenants = await tenantsRepo.list();
  const snapshots = await Promise.all(
    tenants.map(async (t) => ({
      tenant: t,
      progress: await computeChecklistProgress(t.id),
      goLive: await canTenantGoLive(t.id),
    }))
  );

  return (
    <section className="mb-16 space-y-4" data-testid="checklist-playground">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">Checklist playground</h2>
        <Separator className="mt-3" />
      </div>
      <p className="text-muted-foreground text-sm">
        <code className="font-mono">computeChecklistProgress()</code> +{' '}
        <code className="font-mono">canTenantGoLive()</code> against the seeded checklist statuses,
        country configs and provider connections.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {snapshots.map(({ tenant, progress, goLive }) => (
          <Card key={tenant.id} size="sm" data-testid={`checklist-snapshot-${tenant.slug}`}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge
                  variant={goLive.canGoLive ? 'secondary' : 'destructive'}
                  className="font-mono"
                >
                  {goLive.canGoLive ? '✓ canGoLive' : '⚠ blocked'}
                </Badge>
                <CardTitle className="text-sm">{tenant.name}</CardTitle>
              </div>
              <CardDescription className="font-mono text-xs">
                {tenant.country} · {tenant.slug} · {progress.completed}/{progress.total} (
                {progress.percentageComplete}%)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="font-mono">
                <span className="text-muted-foreground">pendingRequired </span>
                <span className="text-foreground">{progress.pendingRequired}</span>{' '}
                <span className="text-muted-foreground">pendingOptional </span>
                <span className="text-foreground">{progress.pendingOptional}</span>
              </p>
              {progress.items.length === 0 ? (
                <p className="text-muted-foreground">(no templates)</p>
              ) : (
                <ul className="ml-4 list-disc space-y-0.5 font-mono">
                  {progress.items.map((item) => (
                    <li key={item.template.id}>
                      {item.template.id}{' '}
                      <span
                        className={
                          item.effectiveStatus === 'completed'
                            ? 'text-foreground'
                            : item.effectiveStatus === 'skipped'
                              ? 'text-muted-foreground'
                              : 'text-destructive'
                        }
                      >
                        ({item.effectiveStatus}
                        {item.autoCompleteResolved ? ', auto' : ''})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {goLive.reasons.length > 0 && (
                <>
                  <p className="text-muted-foreground mt-3 font-mono uppercase">reasons</p>
                  <ul className="ml-4 list-disc space-y-0.5 text-[11px]">
                    {goLive.reasons.map((r, i) => (
                      <li key={i} className="font-mono">
                        {r.defaultMessage}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

async function VaultPlayground() {
  const sample = 'test_token_value';
  let cipher: string | null = null;
  let plaintext: string | null = null;
  let error: string | null = null;
  try {
    cipher = encrypt(sample);
    plaintext = decrypt(cipher);
  } catch (err) {
    error = err instanceof EncryptionError ? `${err.code}: ${err.message}` : String(err);
  }

  const recent = await tokenAccessLogRepo.listAll(5);

  const cipherSnippet = cipher ? `${cipher.slice(0, 30)}…` : null;

  return (
    <section className="mb-16 space-y-4" data-testid="vault-playground">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">Vault playground</h2>
        <Separator className="mt-3" />
      </div>
      <p className="text-muted-foreground text-sm">
        Live AES-256-GCM round-trip from <code className="font-mono">@/lib/vault</code>. The
        ciphertext snippet changes on every reload because the IV is random.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm" data-testid="vault-roundtrip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant={error ? 'destructive' : 'secondary'} className="font-mono">
                {error ? '✗ failed' : '✓ ok'}
              </Badge>
              <CardTitle className="text-sm">encrypt → decrypt</CardTitle>
            </div>
            <CardDescription className="font-mono text-xs">plaintext: {sample}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {error ? (
              <p className="text-destructive font-mono">{error}</p>
            ) : (
              <>
                <p>
                  <span className="text-muted-foreground font-mono">cipher </span>
                  <span className="text-foreground font-mono break-all">{cipherSnippet}</span>
                </p>
                <p>
                  <span className="text-muted-foreground font-mono">decrypted </span>
                  <span
                    className={
                      plaintext === sample
                        ? 'text-foreground font-mono'
                        : 'text-destructive font-mono'
                    }
                  >
                    {plaintext}
                  </span>
                </p>
                <p
                  className={
                    plaintext === sample
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-destructive'
                  }
                >
                  {plaintext === sample ? '✓ round-trip identical' : '✗ mismatch'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card size="sm" data-testid="vault-recent-audit">
          <CardHeader>
            <CardTitle className="text-sm">Recent token_access_log entries</CardTitle>
            <CardDescription className="font-mono text-xs">
              latest {recent.length} of all tenants
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs">
            {recent.length === 0 ? (
              <p className="text-muted-foreground">(none)</p>
            ) : (
              <ul className="space-y-1 font-mono">
                {recent.map((row) => (
                  <li key={row.id} className="flex flex-wrap gap-2">
                    <span className="text-muted-foreground">
                      {row.timestamp.replace('T', ' ').slice(0, 19)}
                    </span>
                    <span className="text-foreground">{row.action}</span>
                    <span
                      className={
                        row.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'
                      }
                    >
                      {row.success ? '✓' : '✗'}
                    </span>
                    <span className="text-muted-foreground">{row.connection_id.slice(0, 8)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

async function StoragePlayground() {
  const provider = getActiveProvider();
  const VILLA = '11111111-1111-1111-1111-111111111111';
  const SUPER = 'a0000000-0000-0000-0000-000000000001';

  const sampleBytes = Buffer.from('framewise-debug-sample-bytes');
  let uploadResult: Awaited<ReturnType<typeof uploadMedia>> | null = null;
  let error: string | null = null;
  try {
    uploadResult = await uploadMedia({
      tenantId: VILLA,
      uploadedByUserId: SUPER,
      fileName: `debug_sample_${Date.now()}.txt`,
      mimeType: 'image/png',
      sizeBytes: sampleBytes.byteLength,
      body: sampleBytes,
      altText: { en: 'Debug sample' },
    });
  } catch (err) {
    if (err instanceof StorageError) error = `${err.code}: ${err.message}`;
    else if (err instanceof Error) error = err.message;
    else error = String(err);
  }

  const recentMedia = (await mediaRepo.listByTenant(VILLA)).slice(0, 5);

  return (
    <section className="mb-16 space-y-4" data-testid="storage-playground">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">Storage playground</h2>
        <Separator className="mt-3" />
      </div>
      <p className="text-muted-foreground text-sm">
        Active provider for this request: <code className="font-mono">{provider.name}</code> (
        {provider.available ? 'available' : 'unavailable'}). The mock provider returns deterministic
        Picsum URLs; Vercel Blob is used when{' '}
        <code className="font-mono">BLOB_READ_WRITE_TOKEN</code> is set.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm" data-testid="storage-upload-result">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant={error ? 'destructive' : 'secondary'} className="font-mono">
                {error ? '✗ failed' : '✓ uploaded'}
              </Badge>
              <CardTitle className="text-sm">Live upload via {provider.name}</CardTitle>
            </div>
            <CardDescription className="font-mono text-xs">
              Buffer({sampleBytes.byteLength} bytes) → uploadMedia()
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {error ? (
              <p className="text-destructive font-mono">{error}</p>
            ) : uploadResult ? (
              <>
                <p className="font-mono">
                  <span className="text-muted-foreground">path </span>
                  <span className="text-foreground break-all">{uploadResult.upload.path}</span>
                </p>
                <p className="font-mono">
                  <span className="text-muted-foreground">url </span>
                  <span className="text-foreground break-all">{uploadResult.upload.url}</span>
                </p>
                <p className="font-mono">
                  <span className="text-muted-foreground">media.id </span>
                  <span className="text-foreground">{uploadResult.media.id}</span>
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card size="sm" data-testid="storage-recent-media">
          <CardHeader>
            <CardTitle className="text-sm">Recent media (villa)</CardTitle>
            <CardDescription className="font-mono text-xs">
              latest {recentMedia.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs">
            {recentMedia.length === 0 ? (
              <p className="text-muted-foreground">(none)</p>
            ) : (
              <ul className="space-y-1 font-mono">
                {recentMedia.map((m) => (
                  <li key={m.id} className="flex flex-wrap gap-2">
                    <span className="text-muted-foreground">
                      {m.created_at.replace('T', ' ').slice(0, 19)}
                    </span>
                    <span className="text-foreground">{m.file_name}</span>
                    <span className="text-muted-foreground">({m.mime_type})</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

async function ConnectorFrameworkPlayground() {
  const VILLA = '11111111-1111-1111-1111-111111111111';
  const SUPER = 'a0000000-0000-0000-0000-000000000001';

  const all = getAllConnectors();
  const ctx = { tenantId: VILLA, userId: SUPER };

  // Two scenarios: a valid + an invalid API-key submission against the
  // mock connector. Errors are expected for the invalid case; we
  // capture both outcomes so the page can render success + failure
  // paths side-by-side.
  let validResult: Awaited<ReturnType<typeof submitApiKeyCredentials>> | null = null;
  let validError: string | null = null;
  try {
    validResult = await submitApiKeyCredentials({
      connector: mockApiKeyConnector,
      credentials: { api_key: 'debug_value', subdomain: 'demo' },
      context: ctx,
    });
  } catch (err) {
    validError = err instanceof ConnectorError ? `${err.code}: ${err.message}` : String(err);
  }

  let invalidErrorCode: string | null = null;
  let invalidErrorMessage: string | null = null;
  try {
    await submitApiKeyCredentials({
      connector: mockApiKeyConnector,
      credentials: { api_key: 'invalid' },
      context: ctx,
    });
  } catch (err) {
    if (err instanceof ConnectorError) {
      invalidErrorCode = err.code;
      invalidErrorMessage = err.message;
    } else {
      invalidErrorMessage = String(err);
    }
  }

  return (
    <section className="mb-16 space-y-4" data-testid="connector-framework-playground">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">
          Connector framework playground
        </h2>
        <Separator className="mt-3" />
      </div>
      <p className="text-muted-foreground text-sm">
        {all.length} connector(s) registered. Step 14 ships the framework + mock connectors; steps
        15–23 plug in real providers.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm" data-testid="connector-registry-snapshot">
          <CardHeader>
            <CardTitle className="text-sm">Registered connectors</CardTitle>
            <CardDescription className="font-mono text-xs">getAllConnectors()</CardDescription>
          </CardHeader>
          <CardContent className="text-xs">
            {all.length === 0 ? (
              <p className="text-muted-foreground">(none)</p>
            ) : (
              <ul className="space-y-1 font-mono">
                {all.map((c) => (
                  <li key={c.id} className="flex flex-wrap gap-2">
                    <span className="text-foreground">{c.id}</span>
                    <span className="text-muted-foreground">
                      ({c.category}/{c.authMethod}
                      {c.developmentOnly ? ', dev' : ''})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card size="sm" data-testid="connector-flows-snapshot">
          <CardHeader>
            <CardTitle className="text-sm">submitApiKeyCredentials()</CardTitle>
            <CardDescription className="font-mono text-xs">mock-api-key</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div data-testid="connector-flow-success">
              <p className="font-mono">
                <Badge
                  variant={validResult?.success ? 'secondary' : 'destructive'}
                  className="mr-2 font-mono"
                >
                  {validResult?.success ? '✓ ok' : '✗ failed'}
                </Badge>
                api_key=&quot;debug_value&quot;
              </p>
              {validResult?.success && (
                <p className="text-muted-foreground mt-1 font-mono">
                  connectionId <span className="text-foreground">{validResult.connectionId}</span>
                </p>
              )}
              {validError && <p className="text-destructive font-mono">{validError}</p>}
            </div>
            <div data-testid="connector-flow-failure">
              <p className="font-mono">
                <Badge variant="destructive" className="mr-2 font-mono">
                  ✗ rejected
                </Badge>
                api_key=&quot;invalid&quot;
              </p>
              {invalidErrorCode && (
                <p className="text-destructive mt-1 font-mono">
                  {invalidErrorCode}: {invalidErrorMessage}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <MoneybirdConnectorDebug />
      <EBoekhoudenConnectorDebug />
      <MollieConnectorDebug />
    </section>
  );
}

function MoneybirdConnectorDebug() {
  const moneybird = getConnector('moneybird');
  if (!moneybird) {
    return (
      <Card size="sm" data-testid="moneybird-connector-debug">
        <CardHeader>
          <CardTitle className="text-sm">Moneybird connector</CardTitle>
          <CardDescription className="font-mono text-xs">
            not registered (this should not happen in step 15+)
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card size="sm" data-testid="moneybird-connector-debug" className="mt-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            ✓ registered
          </Badge>
          <CardTitle className="text-sm">Moneybird connector</CardTitle>
        </div>
        <CardDescription className="font-mono text-xs">
          Real provider — first connector with live HTTP calls.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        <p className="font-mono">
          <span className="text-muted-foreground">id </span>
          <span className="text-foreground">{moneybird.id}</span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">category </span>
          <span className="text-foreground">{moneybird.category}</span>
          <span className="text-muted-foreground"> · authMethod </span>
          <span className="text-foreground">{moneybird.authMethod}</span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">availableIn </span>
          <span className="text-foreground">
            {(moneybird.availableIn ?? []).join(', ') || '(any)'}
          </span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">apiKey.fields </span>
          <span className="text-foreground">{moneybird.apiKey?.fields.length ?? 0}</span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">api base </span>
          <span className="text-foreground">https://moneybird.com/api/v2</span>
        </p>
        <p className="text-muted-foreground italic">
          testConnection is wired to the real Moneybird API; no debug call here so /debug/data never
          burns rate limits.
        </p>
      </CardContent>
    </Card>
  );
}

function EBoekhoudenConnectorDebug() {
  const ebh = getConnector('e-boekhouden');
  if (!ebh) {
    return (
      <Card size="sm" data-testid="e-boekhouden-connector-debug" className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">e-Boekhouden connector</CardTitle>
          <CardDescription className="font-mono text-xs">
            not registered (this should not happen in step 16+)
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sourceTokenConfigured = Boolean(process.env.EBOEKHOUDEN_SOURCE_API_TOKEN);

  return (
    <Card size="sm" data-testid="e-boekhouden-connector-debug" className="mt-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            ✓ registered
          </Badge>
          <CardTitle className="text-sm">e-Boekhouden connector</CardTitle>
        </div>
        <CardDescription className="font-mono text-xs">
          Two-token REST API with 55-min session cache.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        <p className="font-mono">
          <span className="text-muted-foreground">id </span>
          <span className="text-foreground">{ebh.id}</span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">category </span>
          <span className="text-foreground">{ebh.category}</span>
          <span className="text-muted-foreground"> · authMethod </span>
          <span className="text-foreground">{ebh.authMethod}</span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">availableIn </span>
          <span className="text-foreground">{(ebh.availableIn ?? []).join(', ') || '(any)'}</span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">apiKey.fields </span>
          <span className="text-foreground">{ebh.apiKey?.fields.length ?? 0}</span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">api base </span>
          <span className="text-foreground">https://api.e-boekhouden.nl/v1</span>
        </p>
        <p className="font-mono" data-testid="e-boekhouden-source-token-status">
          <span className="text-muted-foreground">EBOEKHOUDEN_SOURCE_API_TOKEN </span>
          <span
            className={
              sourceTokenConfigured
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-amber-700 dark:text-amber-300'
            }
          >
            {sourceTokenConfigured ? '✓ configured' : '⚠ not configured'}
          </span>
        </p>
        <p className="text-muted-foreground italic">
          {sourceTokenConfigured
            ? 'Both tokens present; testConnection will reach the real API.'
            : 'Without the integrator token, testConnection returns CONFIGURATION_INCOMPLETE.'}
        </p>
      </CardContent>
    </Card>
  );
}

function MollieConnectorDebug() {
  const mollie = getConnector('mollie');
  if (!mollie) {
    return (
      <Card size="sm" data-testid="mollie-connector-debug" className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">Mollie connector</CardTitle>
          <CardDescription className="font-mono text-xs">
            not registered (this should not happen in step 17+)
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card size="sm" data-testid="mollie-connector-debug" className="mt-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            ✓ registered
          </Badge>
          <CardTitle className="text-sm">Mollie connector</CardTitle>
        </div>
        <CardDescription className="font-mono text-xs">
          First payment provider — test/live key auto-detection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        <p className="font-mono">
          <span className="text-muted-foreground">id </span>
          <span className="text-foreground">{mollie.id}</span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">category </span>
          <span className="text-foreground">{mollie.category}</span>
          <span className="text-muted-foreground"> · authMethod </span>
          <span className="text-foreground">{mollie.authMethod}</span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">availableIn </span>
          <span className="text-foreground">
            {(mollie.availableIn ?? []).join(', ') || '(any)'}
          </span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">apiKey.fields </span>
          <span className="text-foreground">{mollie.apiKey?.fields.length ?? 0}</span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">api base </span>
          <span className="text-foreground">https://api.mollie.com/v2</span>
        </p>
        <p className="font-mono">
          <span className="text-muted-foreground">supported key formats </span>
          <span className="text-foreground">test_… · live_…</span>
        </p>
        <p className="text-muted-foreground italic">
          testConnection performs a parallel GET /organizations/me + GET /methods round-trip against
          api.mollie.com; no debug call here so /debug/data never burns rate limits.
        </p>
      </CardContent>
    </Card>
  );
}

async function AuthPlayground() {
  const user = await getCurrentUser();
  return (
    <section className="mb-16 space-y-4" data-testid="auth-playground">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">Auth playground</h2>
        <Separator className="mt-3" />
      </div>
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant={user ? 'secondary' : 'outline'} className="font-mono">
              {user ? 'authenticated' : 'anonymous'}
            </Badge>
            <CardTitle className="text-sm">Current session</CardTitle>
          </div>
          <CardDescription className="font-mono text-xs">
            getCurrentUser() · server-rendered
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 font-mono text-xs">
          {user ? (
            <>
              <p>
                <span className="text-muted-foreground">id </span>
                <span className="text-foreground">{user.id}</span>
              </p>
              <p>
                <span className="text-muted-foreground">email </span>
                <span className="text-foreground">{user.email}</span>
              </p>
              <p>
                <span className="text-muted-foreground">name </span>
                <span className="text-foreground">{user.name}</span>
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No active session.</p>
          )}
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Test credentials (dev only)</CardTitle>
          <CardDescription className="text-xs">
            Visit{' '}
            <Link className="text-foreground underline" href="/login">
              /login
            </Link>{' '}
            to start a session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 font-mono text-xs">
          <p>
            <span className="text-muted-foreground">super-admin </span>
            <span className="text-foreground">framewise@example.com / Framewise2025!</span>
          </p>
          <p>
            <span className="text-muted-foreground">villa-owner </span>
            <span className="text-foreground">owner@demo-villa.example / Villa2025!</span>
          </p>
          <p>
            <span className="text-muted-foreground">restaurant-owner </span>
            <span className="text-foreground">owner@demo-restaurant.example / Restaurant2025!</span>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

async function TenantResolutionPlayground() {
  const cases: Array<{ label: string; hostname: string; pathname: string }> = [
    { label: 'Custom domain', hostname: 'villa-bonbini.com', pathname: '/' },
    { label: 'Subdomain', hostname: 'demo-villa.framewise.app', pathname: '/' },
    {
      label: 'Path prefix',
      hostname: 'framewise-pi.vercel.app',
      pathname: '/sites/demo-villa/over-ons',
    },
    { label: 'No tenant', hostname: 'framewise-pi.vercel.app', pathname: '/' },
  ];

  const resolved: Array<{
    label: string;
    hostname: string;
    pathname: string;
    result: TenantResolutionResult;
  }> = await Promise.all(
    cases.map(async (c) => ({
      ...c,
      result: await resolveTenant({ hostname: c.hostname, pathname: c.pathname }),
    }))
  );

  return (
    <section className="mb-16 space-y-4" data-testid="tenant-resolution-playground">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">
          Tenant resolution playground
        </h2>
        <Separator className="mt-3" />
      </div>
      <p className="text-muted-foreground text-sm">
        Live calls to <code className="font-mono">resolveTenant()</code> for the four canonical
        input shapes the middleware sees.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {resolved.map((r) => (
          <Card key={r.label} size="sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant={r.result.tenantId ? 'secondary' : 'outline'} className="font-mono">
                  {r.result.strategy}
                </Badge>
                <CardTitle className="text-sm">{r.label}</CardTitle>
              </div>
              <CardDescription className="font-mono text-xs">
                {r.hostname}
                {r.pathname}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <p className="font-mono">
                <span className="text-muted-foreground">tenantId </span>
                <span className="text-foreground">
                  {r.result.tenantId ?? '(none — Framewise marketing)'}
                </span>
              </p>
              {r.result.matchedSlug && (
                <p className="font-mono">
                  <span className="text-muted-foreground">matchedSlug </span>
                  <span className="text-foreground">{r.result.matchedSlug}</span>
                </p>
              )}
              {r.result.residualPath !== undefined && (
                <p className="font-mono">
                  <span className="text-muted-foreground">residualPath </span>
                  <span className="text-foreground">{r.result.residualPath}</span>
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

async function ValidationPlayground() {
  const examples = await runValidationExamples();
  return (
    <section className="mb-16 space-y-4" data-testid="validation-playground">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">Validation playground</h2>
        <Separator className="mt-3" />
      </div>
      <p className="text-muted-foreground text-sm">
        Three live validation calls against the same schemas the mock adapter uses on every write.
        Refreshing this page re-runs them.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {examples.map((ex) => (
          <Card key={ex.title} size="sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant={ex.ok ? 'secondary' : 'destructive'} className="font-mono">
                  {ex.ok ? '✅ ok' : '❌ rejected'}
                </Badge>
                <CardTitle className="text-sm">{ex.title}</CardTitle>
              </div>
              <CardDescription className="text-xs">{ex.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs">
              <p className="font-mono">{ex.outcome}</p>
              {ex.issues && ex.issues.length > 0 && (
                <ul className="text-muted-foreground mt-2 list-disc space-y-0.5 pl-5">
                  {ex.issues.map((issue, i) => (
                    <li key={i} className="font-mono">
                      <span className="text-foreground">{issue.path || '(root)'}</span>:{' '}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

type PlaygroundExample = {
  title: string;
  description: string;
  ok: boolean;
  outcome: string;
  issues?: Array<{ path: string; message: string }>;
};

async function runValidationExamples(): Promise<PlaygroundExample[]> {
  const results: PlaygroundExample[] = [];

  // 1) Valid tenant insert
  {
    const valid = tenantInsertSchema.safeParse({
      slug: 'demo-fresh',
      name: 'Demo Fresh',
      country: 'NL',
      vat_number: null,
      crib_number: null,
      subscription_plan_id: 'b0000000-0000-0000-0000-000000000001',
      status: 'onboarding',
      custom_domain: null,
      default_locale: 'nl',
      enabled_locales: ['nl'],
    });
    results.push({
      title: 'Valid tenant insert',
      description: 'tenantInsertSchema.safeParse() with a clean payload',
      ok: valid.success,
      outcome: valid.success ? 'Parsed successfully' : 'Unexpectedly rejected',
    });
  }

  // 2) Invalid tenant insert (slug + locale mismatch)
  {
    const invalid = tenantInsertSchema.safeParse({
      slug: 'NOT VALID!',
      name: 'X',
      country: 'NL',
      vat_number: null,
      crib_number: null,
      subscription_plan_id: 'not-a-uuid',
      status: 'onboarding',
      custom_domain: null,
      default_locale: 'fr',
      enabled_locales: ['nl', 'en'],
    });
    results.push({
      title: 'Invalid tenant insert',
      description: 'Bad slug, short name, non-UUID plan id, default not in enabled_locales',
      ok: invalid.success,
      outcome: invalid.success ? 'Unexpectedly accepted' : 'Rejected as expected',
      issues: invalid.success
        ? []
        : invalid.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
    });
  }

  // 3) Booking that conflicts with seeded reservation
  {
    const VILLA_ID = '11111111-1111-1111-1111-111111111111';
    const conflictPayload = {
      tenant_id: VILLA_ID,
      status: 'pending' as const,
      start_date: '2026-06-18',
      end_date: '2026-06-25',
      persons: 2,
      guest_name: 'Conflict Demo',
      guest_email: 'conflict@example.com',
      guest_phone: null,
      total_price_cents: 100000,
      currency: 'EUR' as const,
      payment_status: 'unpaid' as const,
      payment_provider: null,
      payment_reference: null,
      notes: null,
    };
    const schemaResult = bookingInsertSchema.safeParse(conflictPayload);
    if (!schemaResult.success) {
      results.push({
        title: 'Booking with conflict',
        description: 'Range overlapping the seeded confirmed booking',
        ok: false,
        outcome: 'Rejected by schema before availability check',
        issues: schemaResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    } else {
      try {
        const av = await checkBookingAvailability(
          conflictPayload.tenant_id,
          conflictPayload.start_date,
          conflictPayload.end_date
        );
        results.push({
          title: 'Booking with conflict',
          description: 'Range overlapping the seeded confirmed booking 2026-06-15 → 2026-06-22',
          ok: av.ok,
          outcome: av.ok
            ? 'Unexpectedly available'
            : `Conflict with ${av.conflicts.length} booking(s)`,
          issues: av.conflicts.map((c) => ({
            path: `conflict:${c.id}`,
            message: `${c.start_date} → ${c.end_date} (${c.status})`,
          })),
        });
      } catch (err) {
        results.push({
          title: 'Booking with conflict',
          description: 'Range overlapping the seeded confirmed booking',
          ok: false,
          outcome: err instanceof ValidationError ? err.message : 'Unexpected error during check',
        });
      }
    }
  }

  return results;
}

function PreviewSection<T>({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: T[];
  emptyHint: string;
}) {
  return (
    <section className="mb-16 space-y-4">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">
          {title}{' '}
          <span className="text-muted-foreground text-base font-medium">({rows.length})</span>
        </h2>
        <Separator className="mt-3" />
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyHint}</p>
      ) : (
        <pre className="bg-card text-card-foreground ring-border max-h-96 overflow-auto rounded-lg p-4 font-mono text-xs ring-1">
          {JSON.stringify(rows.slice(0, 3), null, 2)}
        </pre>
      )}
    </section>
  );
}
