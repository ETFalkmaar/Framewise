import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';

import { connectionsRepo } from '@/lib/data';
import { getActiveTenantForUser } from '@/lib/auth';
import { getAllConnectors, type ConnectorDefinition } from '@/lib/connectors';
import type { CountryCode, ProviderCategory } from '@/lib/countries';
import type { ProviderConnection } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ConnectorCard, type ConnectorCardStatus } from '@/components/connectors/connector-card';

const CATEGORY_ORDER: ProviderCategory[] = ['accounting', 'payments', 'phone', 'crm', 'newsletter'];

const ERROR_MESSAGE_KEY: Record<string, string> = {
  PROVIDER_NOT_FOUND: 'errors.providerNotFound',
  STATE_VALIDATION: 'errors.stateValidation',
  FLOW_ABORTED: 'errors.flowAborted',
  INVALID_CREDENTIALS: 'errors.invalidCredentials',
  TOKEN_EXCHANGE_FAILED: 'errors.tokenExchange',
  UNSUPPORTED_FLOW: 'errors.unsupportedFlow',
  UNKNOWN: 'errors.unknown',
};

export default async function AddConnectorHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ error?: string; providerId?: string }>;
}) {
  const { locale } = await params;
  const { error: errorCode, providerId: errorProviderId } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('account.connections');
  const tAccount = await getTranslations('account');

  const tenant = await getActiveTenantForUser();
  if (!tenant) {
    return (
      <main
        data-testid="add-connector-page"
        className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-md flex-col px-6 py-24"
      >
        <header className="mb-10">
          <Badge variant="outline" className="font-mono">
            /account/connections/add
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">{t('addPage.title')}</h1>
        </header>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">{t('noTenant')}</CardTitle>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const country = tenant.country as CountryCode;
  const isProd = process.env.NODE_ENV === 'production';
  const all = getAllConnectors();
  const visibleConnectors = all.filter((c) => {
    if (c.developmentOnly && isProd) return false;
    if (c.availableIn && !c.availableIn.includes(country)) return false;
    return true;
  });

  // Decorate each connector with its current connection status (if any).
  const connections = await connectionsRepo.listByTenant(tenant.id);
  const byProvider = new Map<string, ProviderConnection>(connections.map((c) => [c.provider, c]));

  const cardCopy = {
    statusLabel: {
      connected: t('statusLabel.connected'),
      disconnected: t('statusLabel.disconnected'),
      error: t('statusLabel.error'),
      expired: t('statusLabel.expired'),
      none: t('statusLabel.none'),
    } satisfies Record<ConnectorCardStatus, string>,
    authMethodLabel: {
      oauth: t('addPage.authMethod.oauth'),
      api_key: t('addPage.authMethod.apiKey'),
    },
    complexity: {
      easy: t('addPage.complexity.easy'),
      medium: t('addPage.complexity.medium'),
      advanced: t('addPage.complexity.advanced'),
    },
    devOnly: t('addPage.devOnly'),
  };

  function statusFor(c: ConnectorDefinition): ConnectorCardStatus {
    const conn = byProvider.get(c.id);
    if (!conn) return 'none';
    return conn.status as ConnectorCardStatus;
  }

  // Group connectors: real categories first, dev-only ("Test") at the end.
  const grouped = new Map<string, ConnectorDefinition[]>();
  const TEST_GROUP = 'test';
  for (const c of visibleConnectors) {
    const key = c.developmentOnly ? TEST_GROUP : c.category;
    const arr = grouped.get(key) ?? [];
    arr.push(c);
    grouped.set(key, arr);
  }

  const orderedCategories = CATEGORY_ORDER.filter((cat) => grouped.has(cat));
  const showTestGroup = grouped.has(TEST_GROUP);

  return (
    <main
      data-testid="add-connector-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-xl flex-col px-6 py-16"
    >
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline" className="font-mono">
            /account/connections/add
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">{t('addPage.title')}</h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm">{t('addPage.description')}</p>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          {tenant.country} · {tenant.name}
        </Badge>
      </header>

      {errorCode && (
        <div
          data-testid="add-connector-error"
          className="border-destructive/40 bg-destructive/5 text-destructive mb-8 rounded-lg border p-4 text-sm"
        >
          ⚠ {t(ERROR_MESSAGE_KEY[errorCode] ?? 'errors.unknown')}
          {errorProviderId ? ` (${errorProviderId})` : ''}
        </div>
      )}

      {orderedCategories.map((cat) => (
        <section key={cat} className="mb-10" data-testid={`add-connector-section-${cat}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-display-sm font-semibold tracking-tight">
              {t(`categoryLabel.${cat as ProviderCategory}`)}
            </h2>
          </div>
          <Separator className="mb-4" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.get(cat)!.map((c) => (
              <ConnectorCard
                key={c.id}
                connector={c}
                status={statusFor(c)}
                locale={locale}
                copy={cardCopy}
              />
            ))}
          </div>
        </section>
      ))}

      {showTestGroup && (
        <section className="mb-10" data-testid="add-connector-section-test">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-display-sm font-semibold tracking-tight">
              {t('addPage.testCategory')}
            </h2>
            <Badge variant="outline" className="font-mono text-[10px]">
              dev only
            </Badge>
          </div>
          <Separator className="mb-4" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.get(TEST_GROUP)!.map((c) => (
              <ConnectorCard
                key={c.id}
                connector={c}
                status={statusFor(c)}
                locale={locale}
                copy={cardCopy}
              />
            ))}
          </div>
        </section>
      )}

      <Separator className="my-12" />
      <p className="text-muted-foreground font-mono text-xs">
        <Link href="/account/connections" className="hover:text-foreground underline">
          ← {t('title')}
        </Link>
        {' · '}
        <Link href="/account" className="hover:text-foreground underline">
          {tAccount('title')}
        </Link>
      </p>
    </main>
  );
}
