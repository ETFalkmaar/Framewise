import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { connectionsRepo } from '@/lib/data';
import { getActiveTenantForUser } from '@/lib/auth';
import { canTenantGoLive, getRequiredConnectionsForTenant } from '@/lib/validation';
import {
  getCountryConfig,
  getProvidersForCountry,
  type CountryCode,
  type ProviderCategory,
} from '@/lib/countries';
import type { ProviderConnection } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ConnectionStatusCard,
  type ConnectionDisplayStatus,
} from '@/components/connections/connection-status-card';

const CATEGORY_ORDER: ProviderCategory[] = ['accounting', 'payments', 'phone', 'crm', 'newsletter'];

export default async function ConnectionsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('account.connections');
  const tAccount = await getTranslations('account');

  const tenant = await getActiveTenantForUser();

  if (!tenant) {
    return (
      <main
        data-testid="connections-page"
        className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-md flex-col px-6 py-24"
      >
        <header className="mb-10">
          <Badge variant="outline" className="font-mono">
            /account/connections
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">{t('title')}</h1>
        </header>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">{t('noTenant')}</CardTitle>
          </CardHeader>
        </Card>
        <p className="mt-8">
          <Link
            href="/account"
            className="text-muted-foreground hover:text-foreground font-mono text-xs underline"
          >
            ← {tAccount('title')}
          </Link>
        </p>
      </main>
    );
  }

  const country = tenant.country as CountryCode;
  const countryConfig = getCountryConfig(country);
  const connections = await connectionsRepo.listByTenant(tenant.id);
  const goLive = await canTenantGoLive(tenant.id);
  const required = await getRequiredConnectionsForTenant(tenant.id);

  const statusLabels = {
    connected: t('statusLabel.connected'),
    disconnected: t('statusLabel.disconnected'),
    error: t('statusLabel.error'),
    expired: t('statusLabel.expired'),
    none: t('statusLabel.none'),
  } satisfies Record<ConnectionDisplayStatus, string>;

  const cardLabels = {
    statusLabel: statusLabels,
    lastUsed: t('lastUsed'),
    neverUsed: t('neverUsed'),
    expiresAt: t('expiresAt'),
    noConnection: t('noConnection'),
  };

  return (
    <main
      data-testid="connections-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-xl flex-col px-6 py-16"
    >
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline" className="font-mono">
            /account/connections
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <Badge variant="secondary">
            {countryConfig?.flagEmoji} {tenant.country}
          </Badge>
          <Badge variant="outline">{tenant.name}</Badge>
        </div>
      </header>

      {goLive.canGoLive ? (
        <div
          data-testid="connections-banner-ok"
          className="mb-8 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm"
        >
          <span className="font-medium text-emerald-700 dark:text-emerald-300">
            ✓ {t('allConfigured')}
          </span>
        </div>
      ) : (
        <div
          data-testid="connections-banner-missing"
          className="mb-8 space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"
        >
          <p className="font-medium text-amber-700 dark:text-amber-300">⚠ {t('missing')}</p>
          <ul className="text-muted-foreground ml-5 list-disc font-mono text-xs">
            {goLive.missingCategories.map((cat) => (
              <li key={cat}>{t(`categoryLabel.${cat}`)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-10">
        {CATEGORY_ORDER.map((cat) => {
          const providers = getProvidersForCountry(country, cat);
          if (providers.length === 0) return null;
          const requiredEntry = required.required.find((r) => r.category === cat);
          return (
            <section key={cat} data-testid={`connections-section-${cat}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-display-sm font-semibold tracking-tight">
                  {t(`categoryLabel.${cat}`)}
                </h2>
                {requiredEntry && (
                  <Badge
                    variant={requiredEntry.isConfigured ? 'secondary' : 'outline'}
                    className="font-mono text-[10px]"
                  >
                    {requiredEntry.isConfigured ? '✓' : '!'}{' '}
                    {requiredEntry.isConfigured ? t('statusLabel.connected') : t('missing')}
                  </Badge>
                )}
              </div>
              <Separator className="mb-4" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {providers.map((p) => {
                  const conn: ProviderConnection | null =
                    connections.find((c) => c.provider === p.id) ?? null;
                  return (
                    <ConnectionStatusCard
                      key={p.id}
                      provider={p}
                      connection={conn}
                      byoaDisclaimer={t('byoaDisclaimer')}
                      labels={cardLabels}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <Separator className="my-12" />
      <p className="text-muted-foreground font-mono text-xs">
        <Link href="/account" className="hover:text-foreground underline">
          ← {tAccount('title')}
        </Link>
      </p>
    </main>
  );
}
