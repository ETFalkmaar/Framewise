import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  bookingsRepo,
  pagesRepo,
  subscriptionsRepo,
  tableCounts,
  tenantsRepo,
  usersRepo,
} from '@/lib/data';
import {
  assertProviderAvailable,
  bookingInsertSchema,
  checkBookingAvailability,
  tenantInsertSchema,
  ValidationError,
} from '@/lib/validation';
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

      <AuthPlayground />
    </main>
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
