import { Link } from '@/i18n/navigation';
import type { ConnectorDefinition } from '@/lib/connectors';
import { getProviderById } from '@/lib/countries';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const AUTH_METHOD_ICON: Record<ConnectorDefinition['authMethod'], string> = {
  oauth: '🔐',
  api_key: '🗝️',
};

export type ConnectorCardStatus = 'connected' | 'disconnected' | 'error' | 'expired' | 'none';

const STATUS_DOT: Record<ConnectorCardStatus, string> = {
  connected: 'bg-emerald-500',
  disconnected: 'bg-muted-foreground/40',
  error: 'bg-red-500',
  expired: 'bg-red-500',
  none: 'bg-muted-foreground/30',
};

const STATUS_BADGE: Record<ConnectorCardStatus, 'secondary' | 'outline' | 'destructive' | 'ghost'> =
  {
    connected: 'secondary',
    disconnected: 'outline',
    error: 'destructive',
    expired: 'destructive',
    none: 'ghost',
  };

export interface ConnectorCardProps {
  connector: ConnectorDefinition;
  status: ConnectorCardStatus;
  locale: 'nl' | 'fr' | 'en';
  copy: {
    statusLabel: Record<ConnectorCardStatus, string>;
    authMethodLabel: Record<ConnectorDefinition['authMethod'], string>;
    complexity: Record<'easy' | 'medium' | 'advanced', string>;
    devOnly: string;
  };
}

export function ConnectorCard({ connector, status, locale, copy }: ConnectorCardProps) {
  const meta = getProviderById(connector.id);
  const name = meta?.name ?? connector.id;
  const description = meta?.description[locale] ?? '';
  const complexity = meta?.setupComplexity ?? 'medium';

  return (
    <Card
      size="sm"
      data-testid={`connector-card-${connector.id}`}
      data-status={status}
      data-auth-method={connector.authMethod}
      className="hover:bg-muted/40 h-full transition"
    >
      <Link
        href={`/account/connections/add/${connector.id}`}
        className="block focus-visible:outline-none"
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-base">
              {AUTH_METHOD_ICON[connector.authMethod]}
            </span>
            <span
              aria-hidden="true"
              className={cn('inline-block h-2.5 w-2.5 rounded-full', STATUS_DOT[status])}
            />
            <CardTitle className="text-sm">{name}</CardTitle>
            <Badge variant={STATUS_BADGE[status]} className="ml-auto font-mono text-[10px]">
              {copy.statusLabel[status]}
            </Badge>
          </div>
          <CardDescription className="font-mono text-[11px]">
            {connector.id} · {copy.authMethodLabel[connector.authMethod]} ·{' '}
            {copy.complexity[complexity]}
            {connector.developmentOnly ? ` · ${copy.devOnly}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">
          {description ? <p className="line-clamp-3">{description}</p> : null}
        </CardContent>
      </Link>
    </Card>
  );
}
