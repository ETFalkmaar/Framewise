import type { ProviderConnection } from '@/types/database';
import type { ProviderEntry } from '@/lib/countries';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type ConnectionDisplayStatus = ProviderConnection['status'] | 'none';

const STATUS_DOT: Record<ConnectionDisplayStatus, string> = {
  connected: 'bg-emerald-500',
  error: 'bg-red-500',
  expired: 'bg-red-500',
  disconnected: 'bg-muted-foreground/40',
  none: 'bg-muted-foreground/30',
};

const STATUS_BADGE: Record<
  ConnectionDisplayStatus,
  'secondary' | 'destructive' | 'outline' | 'ghost'
> = {
  connected: 'secondary',
  error: 'destructive',
  expired: 'destructive',
  disconnected: 'outline',
  none: 'ghost',
};

export interface ConnectionStatusCardProps {
  provider: ProviderEntry;
  connection: ProviderConnection | null;
  byoaDisclaimer: string;
  labels: {
    statusLabel: Record<ConnectionDisplayStatus, string>;
    lastUsed: string;
    neverUsed: string;
    expiresAt: string;
    noConnection: string;
    /** Optional label for the metadata line ("Connected to: …"). */
    connectedTo?: string;
    /** Optional label for "test mode" badge (Mollie + future payment connectors). */
    testModeBadge?: string;
    /** Optional label for "live" badge. */
    liveBadge?: string;
    /**
     * Optional label for the HubSpot Hub identifier — rendered as
     * "<ui_domain> (Hub <portal_id>)". HubSpot has no test/live mode
     * so no coloured badge.
     */
    portalLabel?: string;
  };
  /**
   * Optional render function for action buttons (typically a
   * `<DisconnectButton />` from `@/components/connectors`). Rendered
   * only when a connection exists.
   */
  renderActions?: (connection: ProviderConnection) => React.ReactNode;
}

export function ConnectionStatusCard({
  provider,
  connection,
  byoaDisclaimer,
  labels,
  renderActions,
}: ConnectionStatusCardProps) {
  const status: ConnectionDisplayStatus = connection?.status ?? 'none';

  return (
    <Card
      size="sm"
      data-testid={`connection-card-${provider.id}`}
      data-status={status}
      className="h-full"
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn('inline-block h-2.5 w-2.5 rounded-full', STATUS_DOT[status])}
            data-testid={`connection-dot-${provider.id}`}
          />
          <CardTitle className="text-sm">{provider.name}</CardTitle>
          <Badge variant={STATUS_BADGE[status]} className="ml-auto font-mono text-[10px]">
            {labels.statusLabel[status]}
          </Badge>
        </div>
        <CardDescription className="font-mono text-xs">
          {provider.id} · {provider.authMethod} · {provider.setupComplexity}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {connection ? (
          <ul className="space-y-1 font-mono">
            {(() => {
              const meta = connection.metadata as
                | {
                    primary_administration_name?: string;
                    organization_name?: string;
                    business_name?: string;
                    /** PayPal-shaped: merchant display name from /v1/identity/oauth2/userinfo. */
                    name?: string;
                    account?: string;
                    key_type?: 'test' | 'live';
                    /** Stripe-shaped: `false` for test-mode connected accounts. */
                    livemode?: boolean;
                    /** PayPal-shaped: 'sandbox' (= test) | 'live'. */
                    environment?: 'sandbox' | 'live';
                    /** HubSpot-shaped: UI domain (`app.hubspot.com` / `app-eu1.hubspot.com`). */
                    ui_domain?: string;
                    /** HubSpot-shaped: numeric Hub identifier persisted as a string. */
                    portal_id?: string;
                  }
                | undefined;
              const accountLabel =
                meta?.primary_administration_name ??
                meta?.organization_name ??
                meta?.business_name ??
                meta?.name ??
                meta?.ui_domain ??
                meta?.account ??
                null;
              if (!accountLabel || !labels.connectedTo) return null;
              // Three providers, three metadata shapes — all map to
              // the same amber/emerald badge:
              //   Mollie  → metadata.key_type    ('test' | 'live')
              //   Stripe  → metadata.livemode    (boolean)
              //   PayPal  → metadata.environment ('sandbox' | 'live')
              const mode: 'test' | 'live' | null =
                meta?.key_type ??
                (meta?.livemode === false
                  ? 'test'
                  : meta?.livemode === true
                    ? 'live'
                    : meta?.environment === 'sandbox'
                      ? 'test'
                      : meta?.environment === 'live'
                        ? 'live'
                        : null);
              return (
                <li
                  className="text-muted-foreground flex flex-wrap items-center gap-1"
                  data-testid={`connection-account-${provider.id}`}
                >
                  <span>
                    {labels.connectedTo}: <span className="text-foreground">{accountLabel}</span>
                    {meta?.portal_id && labels.portalLabel && (
                      <span className="text-muted-foreground">
                        {' '}
                        ({labels.portalLabel}{' '}
                        <span
                          className="text-foreground"
                          data-testid={`connection-portal-id-${provider.id}`}
                        >
                          {meta.portal_id}
                        </span>
                        )
                      </span>
                    )}
                  </span>
                  {mode === 'test' && labels.testModeBadge && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/5 font-mono text-[9px] text-amber-700 dark:text-amber-300"
                      data-testid={`connection-key-type-${provider.id}`}
                    >
                      {labels.testModeBadge}
                    </Badge>
                  )}
                  {mode === 'live' && labels.liveBadge && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/5 font-mono text-[9px] text-emerald-700 dark:text-emerald-300"
                      data-testid={`connection-key-type-${provider.id}`}
                    >
                      {labels.liveBadge}
                    </Badge>
                  )}
                </li>
              );
            })()}
            <li className="text-muted-foreground">
              {labels.lastUsed}:{' '}
              <span className="text-foreground">
                {connection.last_used_at
                  ? new Date(connection.last_used_at).toISOString().slice(0, 10)
                  : labels.neverUsed}
              </span>
            </li>
            {connection.expires_at && (
              <li className="text-muted-foreground">
                {labels.expiresAt}:{' '}
                <span className="text-foreground">
                  {new Date(connection.expires_at).toISOString().slice(0, 10)}
                </span>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-muted-foreground font-mono">{labels.noConnection}</p>
        )}
        <p className="text-muted-foreground text-[11px] leading-snug">{byoaDisclaimer}</p>
        {connection && renderActions && <div className="pt-1">{renderActions(connection)}</div>}
      </CardContent>
    </Card>
  );
}
