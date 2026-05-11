'use client';

import { useState, useTransition } from 'react';

import { Link } from '@/i18n/navigation';
import type { Notification, NotificationType } from '@/types/database';

import {
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from '@/app/(i18n)/[locale]/(auth-required)/admin/notifications/actions';

const TYPE_ICON: Record<NotificationType, string> = {
  publish_requested: '🔔',
  publish_approved: '✅',
  publish_rejected: '⚠️',
  system: 'ℹ️',
};

export interface NotificationBellCopy {
  buttonAria: string;
  empty: string;
  markAllRead: string;
  viewAll: string;
  openAction: string;
  unreadAria: string;
  relativeTime: {
    justNow: string;
    /** Pattern with `{count}` placeholder. */
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
  };
}

export interface NotificationBellProps {
  unreadCount: number;
  recent: Notification[];
  copy: NotificationBellCopy;
}

/**
 * Notification bell (step 48). Renders a bell icon with an unread
 * count badge; clicking opens a dropdown of the 10 most recent
 * notifications + a "mark all read" button + a "view all" link
 * to the full notifications page.
 *
 * Server pre-loads the count + the 10 recent notifications via the
 * admin layout — the bell is purely presentation + light client
 * interactions (open/close, mark-as-read).
 */
export function NotificationBell({
  unreadCount,
  recent,
  copy,
}: NotificationBellProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleItemClick(notif: Notification) {
    if (notif.is_read) return;
    startTransition(async () => {
      await markNotificationAsReadAction({ id: notif.id });
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsAsReadAction();
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="notification-bell"
        aria-label={copy.buttonAria}
        aria-expanded={open}
        className="ring-border bg-background hover:bg-muted relative inline-flex items-center justify-center rounded-md px-2 py-1.5 text-sm ring-1 transition"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            aria-label={copy.unreadAria.replace('{count}', String(unreadCount))}
            className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Clickaway backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            data-testid="notification-dropdown"
            role="menu"
            className="bg-background border-border absolute right-0 z-50 mt-2 flex w-[360px] max-w-[90vw] flex-col rounded-md border shadow-xl"
          >
            <div className="border-border flex items-center justify-between border-b p-3">
              <span className="text-sm font-semibold">🔔</span>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={pending || unreadCount === 0}
                data-testid="mark-all-read"
                className="text-muted-foreground hover:text-foreground font-mono text-[11px] disabled:opacity-50"
              >
                {copy.markAllRead}
              </button>
            </div>

            <ul className="divide-border max-h-[400px] divide-y overflow-y-auto">
              {recent.length === 0 ? (
                <li className="text-muted-foreground p-4 text-center text-sm">{copy.empty}</li>
              ) : (
                recent.map((n) => (
                  <li
                    key={n.id}
                    data-testid="notification-item"
                    data-read={n.is_read ? 'true' : 'false'}
                    className={`flex items-start gap-2 p-3 transition ${n.is_read ? '' : 'bg-muted/30'}`}
                  >
                    <span aria-hidden className="text-lg leading-tight">
                      {TYPE_ICON[n.type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-tight font-medium">{n.title}</p>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{n.body}</p>
                      <p className="text-muted-foreground mt-1 font-mono text-[10px]">
                        {formatRelativeTime(n.created_at, copy.relativeTime)}
                      </p>
                      {n.action_url && (
                        <Link
                          href={n.action_url}
                          onClick={() => handleItemClick(n)}
                          className="text-foreground mt-1 inline-block text-[11px] underline"
                        >
                          {copy.openAction}
                        </Link>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>

            <Link
              href="/admin/notifications"
              onClick={() => setOpen(false)}
              className="border-border border-t p-3 text-center font-mono text-[11px] underline"
            >
              {copy.viewAll}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string, copy: NotificationBellCopy['relativeTime']): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return copy.minutesAgo.replace('{count}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return copy.hoursAgo.replace('{count}', String(hours));
  const days = Math.floor(hours / 24);
  return copy.daysAgo.replace('{count}', String(days));
}
