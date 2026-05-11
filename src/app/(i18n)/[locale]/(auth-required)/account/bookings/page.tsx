import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { BookingCalendar } from '@/components/bookings/booking-calendar';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { bookingsRepo } from '@/lib/data';
import { canManageBookings, canViewBookings } from '@/lib/permissions/bookings';

/**
 * Customer-side booking calendar (step 49). Server component:
 *   - Gates on `canViewBookings` (Enterprise + bookings_enabled).
 *   - Resolves `?year=` + `?month=` query params (defaults to current).
 *   - Fetches bookings for that month.
 *   - Renders `<BookingCalendar />`.
 *
 * Non-Enterprise tenants hit the feature-disabled empty state.
 */
export default async function AccountBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const tenant = await getActiveTenantForUser();
  if (!tenant) notFound();

  const t = await getTranslations('bookings');

  const allowed = await canViewBookings(user.id, tenant);
  if (!allowed) {
    return (
      <main
        data-testid="bookings-disabled"
        className="bg-background text-foreground mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16"
      >
        <h1 className="text-display-md font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-4 text-sm">{t('featureDisabled')}</p>
        <p className="text-muted-foreground mt-2 text-xs">{t('enterpriseOnly')}</p>
        <Link
          href="/account"
          className="text-muted-foreground hover:text-foreground mt-6 font-mono text-xs underline"
        >
          ← {t('backToAccount')}
        </Link>
      </main>
    );
  }

  const now = new Date();
  const year = clampInt(search.year, 2020, 2099, now.getUTCFullYear());
  const month = clampInt(search.month, 0, 11, now.getUTCMonth());

  const monthStart = new Date(Date.UTC(year, month, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(year, month + 1, 1)).toISOString();
  const [bookings, canManage] = await Promise.all([
    bookingsRepo.listByTenant(tenant.id, {
      from: monthStart,
      to: monthEnd,
    }),
    canManageBookings(user.id, tenant),
  ]);

  return (
    <main
      data-testid="bookings-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <Link
          href="/account"
          data-testid="back-to-account"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {t('backToAccount')}
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-display-md font-bold tracking-tight">{t('title')}</h1>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/account/bookings/availability"
                data-testid="manage-availability-link"
                className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition"
              >
                {t('manageAvailability')}
              </Link>
              <Link
                href="/account/bookings/calendar"
                data-testid="calendar-feed-link"
                className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition"
              >
                {t('calendarFeed.managementLink')}
              </Link>
            </div>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-2 text-sm">{t('calendar')}</p>
      </header>

      {bookings.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm" data-testid="bookings-empty">
          {t('noBookingsThisMonth')}
        </p>
      ) : null}

      <BookingCalendar
        bookings={bookings}
        year={year}
        month={month}
        basePath="/account/bookings"
        copy={{
          previousMonth: t('previousMonth'),
          nextMonth: t('nextMonth'),
          today: t('today'),
          bookingsCount: t('bookingsCount'),
          bookingsCountOne: t('bookingCount_one'),
          noBookingsThisMonth: t('noBookingsThisMonth'),
          weekdayShort: [
            t('weekdayShort.sun'),
            t('weekdayShort.mon'),
            t('weekdayShort.tue'),
            t('weekdayShort.wed'),
            t('weekdayShort.thu'),
            t('weekdayShort.fri'),
            t('weekdayShort.sat'),
          ],
        }}
      />
    </main>
  );
}

function clampInt(raw: string | undefined, lo: number, hi: number, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}
