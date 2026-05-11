import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getCurrentUser, isUserSuperAdmin } from '@/lib/auth';
import { notificationsRepo } from '@/lib/data';
import type { NotificationType } from '@/types/database';

const PAGE_SIZE = 20;

const TYPE_ICON: Record<NotificationType, string> = {
  publish_requested: '🔔',
  publish_approved: '✅',
  publish_rejected: '⚠️',
  system: 'ℹ️',
};

/**
 * Full notification history for the super-admin (step 48). Filterable
 * by all / unread, paginated 20 per page via `?page=N&filter=unread|all`.
 *
 * Customers don't have a notification page — they see their state
 * inline on `/account` via PublishStatusBanner + GoLiveCelebration.
 */
export default async function AdminNotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ page?: string; filter?: 'all' | 'unread' }>;
}) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isUserSuperAdmin(user.id)) redirect('/account');

  const page = Math.max(1, Number(search.page ?? '1'));
  const filter = search.filter === 'unread' ? 'unread' : 'all';
  const offset = (page - 1) * PAGE_SIZE;

  const items = await notificationsRepo.listByUser(user.id, {
    unreadOnly: filter === 'unread',
    limit: PAGE_SIZE,
    offset,
  });

  const t = await getTranslations('notifications');
  const tType = await getTranslations('notifications.types');

  return (
    <main
      data-testid="notifications-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12"
    >
      <h1 className="text-display-md font-bold tracking-tight">{t('title')}</h1>

      <div className="mt-6 mb-4 flex gap-2">
        <Link
          href="/admin/notifications?filter=all"
          data-testid="filter-all"
          data-active={filter === 'all' ? 'true' : 'false'}
          className={`ring-border rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition ${
            filter === 'all' ? 'bg-muted' : 'bg-background hover:bg-muted/60'
          }`}
        >
          {t('filterAll')}
        </Link>
        <Link
          href="/admin/notifications?filter=unread"
          data-testid="filter-unread"
          data-active={filter === 'unread' ? 'true' : 'false'}
          className={`ring-border rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition ${
            filter === 'unread' ? 'bg-muted' : 'bg-background hover:bg-muted/60'
          }`}
        >
          {t('filterUnread')}
        </Link>
      </div>

      {items.length === 0 ? (
        <p
          className="text-muted-foreground py-10 text-center text-sm"
          data-testid="notifications-empty"
        >
          {filter === 'unread' ? t('emptyUnread') : t('empty')}
        </p>
      ) : (
        <ul className="border-border divide-y divide-border rounded-md border">
          {items.map((n) => (
            <li
              key={n.id}
              data-testid={`notification-row-${n.id}`}
              data-read={n.is_read ? 'true' : 'false'}
              className={`flex items-start gap-3 p-4 ${n.is_read ? '' : 'bg-muted/30'}`}
            >
              <span aria-hidden className="text-xl leading-tight">
                {TYPE_ICON[n.type]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-muted-foreground mt-1 text-xs">{n.body}</p>
                <p className="text-muted-foreground mt-1 font-mono text-[10px]">
                  {tType(n.type)} · {formatIsoCompact(n.created_at)}
                </p>
                {n.action_url && (
                  <Link
                    href={n.action_url}
                    className="text-foreground mt-2 inline-block text-xs underline"
                  >
                    {t('openAction')}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <nav className="mt-6 flex items-center justify-between font-mono text-xs">
        {page > 1 ? (
          <Link
            href={`/admin/notifications?filter=${filter}&page=${page - 1}`}
            className="hover:underline"
          >
            ← {page - 1}
          </Link>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground">page {page}</span>
        {items.length === PAGE_SIZE ? (
          <Link
            href={`/admin/notifications?filter=${filter}&page=${page + 1}`}
            className="hover:underline"
          >
            {page + 1} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}

function formatIsoCompact(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
