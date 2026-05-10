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
