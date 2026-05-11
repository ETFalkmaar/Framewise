import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import type { ConnectionStatusCategory, ConnectorWithStatus } from '@/lib/admin';
import { groupConnectorsByCategory } from '@/lib/admin';

interface ConnectionsCopy {
  title: string;
  connected: string;
  notConnected: string;
  error: string;
  lastSync: string;
  configure: string;
  categoryLabels: Record<ConnectionStatusCategory, string>;
}

export interface ConnectionsCardProps {
  connectors: ConnectorWithStatus[];
  copy: ConnectionsCopy;
}

/**
 * Per-provider status feed on the per-tenant dashboard
 * (step 36). The dashboard always lists every provider so the
 * super-admin sees what's *missing* as well as what's wired.
 */
export function ConnectionsCard({ connectors, copy }: ConnectionsCardProps) {
  const groups = groupConnectorsByCategory(connectors);

  return (
    <Card data-testid="connections-card">
      <CardHeader>
        <CardTitle className="text-sm">{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map((group) => (
          <div key={group.category} data-testid={`connections-group-${group.category}`}>
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              {copy.categoryLabels[group.category]}
            </p>
            <ul className="space-y-1.5">
              {group.items.map((c) => (
                <ConnectorRow key={c.providerId} connector={c} copy={copy} />
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ConnectorRow({
  connector,
  copy,
}: {
  connector: ConnectorWithStatus;
  copy: ConnectionsCopy;
}) {
  const dot = connector.hasError
    ? 'bg-destructive'
    : connector.isConnected
      ? 'bg-emerald-500'
      : 'bg-muted-foreground/40';
  const label = connector.hasError
    ? copy.error
    : connector.isConnected
      ? copy.connected
      : copy.notConnected;

  return (
    <li
      data-testid={`connector-${connector.providerId}`}
      data-connected={connector.isConnected ? 'true' : 'false'}
      className="flex items-center gap-3 text-xs"
    >
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-[140px] font-medium">{connector.providerName}</span>
      <span className="text-muted-foreground font-mono text-[11px]">{label}</span>
      {connector.lastSyncAt && (
        <span className="text-muted-foreground font-mono text-[11px]">
          · {copy.lastSync}: {connector.lastSyncAt.slice(0, 10)}
        </span>
      )}
      <Link
        href={
          connector.isConnected
            ? `/account/connections`
            : `/account/connections/add/${connector.providerId}`
        }
        className="text-muted-foreground hover:text-foreground ml-auto font-mono text-[11px] underline"
      >
        {copy.configure}
      </Link>
    </li>
  );
}
