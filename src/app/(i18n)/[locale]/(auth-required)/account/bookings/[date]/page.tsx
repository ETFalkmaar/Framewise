import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { BookingActions } from '@/components/bookings/booking-actions';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { bookingsRepo } from '@/lib/data';
import { canManageBookings, canViewBookings } from '@/lib/permissions/bookings';
import type { BookingStatus } from '@/types/database';

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

const STATUS_BADGE: Record<BookingStatus, string> = {
  pending: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  confirmed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  cancelled: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  completed: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  no_show: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
};

/**
 * Day-detail page (step 49). Lists every booking whose `start_time`
 * falls on the URL date param. Each booking renders as a card with
 * status + reference code + customer + party-size + notes + a row of
 * action buttons (gated by `canManageBookings`).
 */
export default async function BookingsDayPage({
  params,
}: {
  params: Promise<{ locale: Locale; date: string }>;
}) {
  const { locale, date } = await params;
  setRequestLocale(locale);

  if (!VALID_DATE.test(date)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const tenant = await getActiveTenantForUser();
  if (!tenant) notFound();

  const canView = await canViewBookings(user.id, tenant);
  if (!canView) notFound();
  const canManage = await canManageBookings(user.id, tenant);

  const bookings = await bookingsRepo.listByDate(tenant.id, date);
  const t = await getTranslations('bookings');
  const tStatus = await getTranslations('bookings.statuses');

  return (
    <main
      data-testid="bookings-day"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <Link
          href="/account/bookings"
          data-testid="back-to-calendar"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {t('backToCalendar')}
        </Link>
        <h1 className="text-display-md mt-2 font-bold tracking-tight">{formatHumanDate(date)}</h1>
      </header>

      {bookings.length === 0 ? (
        <p
          className="text-muted-foreground py-10 text-center text-sm"
          data-testid="bookings-day-empty"
        >
          {t('noBookingsOnDay')}
        </p>
      ) : (
        <ul className="grid gap-4">
          {bookings.map((b) => (
            <li
              key={b.id}
              data-testid={`booking-card-${b.id}`}
              className="border-border bg-background rounded-md border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      data-testid={`booking-status-${b.status}`}
                      variant="outline"
                      className={`font-mono text-[10px] uppercase ${STATUS_BADGE[b.status]}`}
                    >
                      {tStatus(b.status)}
                    </Badge>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {t('card.referenceCode', { code: b.reference_code })}
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold">{b.customer_name}</h2>
                  <p className="text-muted-foreground text-sm">
                    {formatTime(b.start_time)} · {b.party_size === 1 ? t('card.partySize_one') : t('card.partySize', { count: b.party_size })}
                  </p>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <p>{b.customer_email}</p>
                  {b.customer_phone && <p>{b.customer_phone}</p>}
                </div>
              </div>

              {(b.notes || b.internal_notes) && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {b.notes && (
                    <div>
                      <p className="text-muted-foreground font-mono text-[10px] uppercase">
                        {t('card.customerNotes')}
                      </p>
                      <p className="text-sm">{b.notes}</p>
                    </div>
                  )}
                  {b.internal_notes && (
                    <div>
                      <p className="text-muted-foreground font-mono text-[10px] uppercase">
                        {t('card.internalNotes')}
                      </p>
                      <p className="text-sm">{b.internal_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {b.cancellation_reason && (
                <p className="text-destructive mt-3 text-xs">
                  ⚠ {b.cancellation_reason}
                </p>
              )}

              {canManage && (
                <BookingActions
                  bookingId={b.id}
                  status={b.status}
                  copy={{
                    confirm: t('actions.confirm'),
                    cancel: t('actions.cancel'),
                    cancelReason: t('actions.cancelReason'),
                    cancelConfirm: t('actions.cancelConfirm'),
                    markNoShow: t('actions.markNoShow'),
                    markNoShowConfirm: t('actions.markNoShowConfirm'),
                    errorGeneric: t('actions.errorGeneric'),
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function formatHumanDate(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  return d.toLocaleDateString('default', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
