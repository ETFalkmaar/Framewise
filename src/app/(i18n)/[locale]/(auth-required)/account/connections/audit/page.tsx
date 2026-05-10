import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { connectionsRepo, usersRepo } from '@/lib/data';
import { getActiveTenantForUser } from '@/lib/auth';
import { listForTenant } from '@/lib/vault';
import type { ProviderConnection, TokenAccessLog, User } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const ACTION_BADGE: Record<
  TokenAccessLog['action'],
  'secondary' | 'outline' | 'destructive' | 'ghost'
> = {
  read: 'outline',
  write: 'secondary',
  refresh: 'secondary',
  revoke: 'destructive',
};

export default async function AuditLogPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('account.connections.audit');
  const tConn = await getTranslations('account.connections');
  const tAccount = await getTranslations('account');

  const tenant = await getActiveTenantForUser();
  if (!tenant) {
    return (
      <main
        data-testid="audit-log-page"
        className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-md flex-col px-6 py-24"
      >
        <header className="mb-10">
          <Badge variant="outline" className="font-mono">
            /account/connections/audit
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">{t('title')}</h1>
        </header>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">{tConn('noTenant')}</CardTitle>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const [entries, connections, users] = await Promise.all([
    listForTenant(tenant.id, 100),
    connectionsRepo.listByTenant(tenant.id),
    usersRepo.list(),
  ]);

  const connectionMap = new Map<string, ProviderConnection>(connections.map((c) => [c.id, c]));
  const userMap = new Map<string, User>(users.map((u) => [u.id, u]));

  const actionLabel: Record<TokenAccessLog['action'], string> = {
    read: t('actionLabel.read'),
    write: t('actionLabel.write'),
    refresh: t('actionLabel.refresh'),
    revoke: t('actionLabel.revoke'),
  };

  return (
    <main
      data-testid="audit-log-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-xl flex-col px-6 py-16"
    >
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline" className="font-mono">
            /account/connections/audit
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm">{t('subtitle')}</p>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          {entries.length} {t('entryCount')}
        </Badge>
      </header>

      {entries.length === 0 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">{t('empty')}</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <div
          data-testid="audit-log-table"
          className="ring-border overflow-x-auto rounded-lg ring-1"
        >
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground font-mono uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">{t('column.timestamp')}</th>
                <th className="px-3 py-2 font-medium">{t('column.connection')}</th>
                <th className="px-3 py-2 font-medium">{t('column.action')}</th>
                <th className="px-3 py-2 font-medium">{t('column.success')}</th>
                <th className="px-3 py-2 font-medium">{t('column.user')}</th>
                <th className="px-3 py-2 font-medium">{t('column.ip')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const conn = connectionMap.get(entry.connection_id);
                const user = entry.user_id ? userMap.get(entry.user_id) : null;
                return (
                  <tr
                    key={entry.id}
                    data-testid={`audit-entry-${entry.id}`}
                    className="border-border/60 hover:bg-muted/40 border-t font-mono"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {entry.timestamp.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="px-3 py-2">
                      {conn ? (
                        <span>
                          <span className="text-muted-foreground">{conn.category}/</span>
                          <span className="text-foreground">{conn.provider}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {entry.connection_id.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={ACTION_BADGE[entry.action]} className="font-mono text-[10px]">
                        {actionLabel[entry.action]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {entry.success ? (
                        <span
                          className="text-emerald-600 dark:text-emerald-400"
                          aria-label="success"
                        >
                          ✓
                        </span>
                      ) : (
                        <span className="text-destructive" aria-label="failure">
                          ✗
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {user ? user.email : t('systemUser')}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">{entry.ip_address ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Separator className="my-12" />
      <p className="text-muted-foreground font-mono text-xs">
        <Link href="/account/connections" className="hover:text-foreground underline">
          ← {tConn('title')}
        </Link>
        {' · '}
        <Link href="/account" className="hover:text-foreground underline">
          {tAccount('title')}
        </Link>
      </p>
    </main>
  );
}
