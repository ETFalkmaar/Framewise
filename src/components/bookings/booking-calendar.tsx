import { Link } from '@/i18n/navigation';
import type { Booking, BookingStatus } from '@/types/database';

export interface BookingCalendarCopy {
  previousMonth: string;
  nextMonth: string;
  today: string;
  /** Pattern with `{count}` placeholder. */
  bookingsCount: string;
  bookingsCountOne: string;
  noBookingsThisMonth: string;
  weekdayShort: string[]; // length 7, Sun..Sat
}

export interface BookingCalendarProps {
  bookings: Booking[];
  year: number;
  /** 0-indexed month (Jan=0). */
  month: number;
  basePath: string; // e.g. '/account/bookings' or '/admin/tenants/[id]/bookings'
  copy: BookingCalendarCopy;
}

const STATUS_DOT_CLASS: Record<BookingStatus, string> = {
  pending: 'bg-amber-500',
  confirmed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
  completed: 'bg-blue-500',
  no_show: 'bg-zinc-500',
};

/**
 * Read-only month calendar (step 49, fase 14 part 1/7). Renders a
 * 6×7 grid of cells; each cell shows the date number + a booking
 * count badge + up to 3 status dots. Clicking a cell with bookings
 * deep-links to the day-detail page; empty cells render as plain
 * text (no link).
 *
 * Server component: receives the booking list for the visible month
 * already filtered by the caller. The caller also decides between
 * `/account/bookings` (customer) and `/admin/tenants/[id]/bookings`
 * (super-admin) via `basePath`.
 */
export function BookingCalendar({
  bookings,
  year,
  month,
  basePath,
  copy,
}: BookingCalendarProps): React.ReactElement {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  // Grid starts on Sunday for parity with most ISO calendars + the
  // weekdayShort copy array.
  const startWeekday = firstOfMonth.getUTCDay();
  const cellCount = 42; // 6 weeks × 7 days
  const today = new Date();
  const todayKey = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(
    today.getUTCDate()
  )}`;

  // Group bookings by yyyy-mm-dd of `start_time`.
  const bookingsByDay = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = b.start_time.slice(0, 10);
    const arr = bookingsByDay.get(key) ?? [];
    arr.push(b);
    bookingsByDay.set(key, arr);
  }

  // Build cells.
  const cells: Array<{
    key: string;
    dayNumber: number | null;
    inMonth: boolean;
    isToday: boolean;
    dayBookings: Booking[];
  }> = [];
  for (let i = 0; i < cellCount; i++) {
    const cellDate = new Date(Date.UTC(year, month, 1 + i - startWeekday));
    const cellKey = `${cellDate.getUTCFullYear()}-${pad(cellDate.getUTCMonth() + 1)}-${pad(
      cellDate.getUTCDate()
    )}`;
    const inMonth = cellDate.getUTCMonth() === month;
    cells.push({
      key: cellKey,
      dayNumber: cellDate.getUTCDate(),
      inMonth,
      isToday: cellKey === todayKey,
      dayBookings: inMonth ? (bookingsByDay.get(cellKey) ?? []) : [],
    });
  }

  const prevMonthHref =
    month === 0
      ? `${basePath}?year=${year - 1}&month=11`
      : `${basePath}?year=${year}&month=${month - 1}`;
  const nextMonthHref =
    month === 11
      ? `${basePath}?year=${year + 1}&month=0`
      : `${basePath}?year=${year}&month=${month + 1}`;

  return (
    <div data-testid="booking-calendar" className="border-border rounded-md border">
      <div className="border-border flex items-center justify-between border-b p-3">
        <Link
          href={prevMonthHref}
          data-testid="calendar-prev-month"
          className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition"
        >
          ← {copy.previousMonth}
        </Link>
        <span className="text-sm font-semibold">
          {monthLabel(year, month, copy)}
        </span>
        <Link
          href={nextMonthHref}
          data-testid="calendar-next-month"
          className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition"
        >
          {copy.nextMonth} →
        </Link>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center font-mono text-[10px] uppercase">
        {copy.weekdayShort.map((w, idx) => (
          <div key={idx} className="p-2">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const hasBookings = cell.dayBookings.length > 0;
          const cellClass = `min-h-[72px] border-r border-b border-border p-2 text-xs ${
            cell.inMonth ? '' : 'bg-muted/10 text-muted-foreground'
          } ${cell.isToday ? 'bg-amber-500/10' : ''}`;
          const content = (
            <>
              <div className="flex items-center justify-between">
                <span className={cell.isToday ? 'font-bold' : ''}>{cell.dayNumber}</span>
                {hasBookings && (
                  <span
                    data-testid={`booking-count-${cell.key}`}
                    className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
                  >
                    {cell.dayBookings.length}
                  </span>
                )}
              </div>
              {hasBookings && (
                <div className="mt-1 flex gap-1">
                  {cell.dayBookings.slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[b.status]}`}
                    />
                  ))}
                </div>
              )}
            </>
          );
          return cell.inMonth && hasBookings ? (
            <Link
              key={cell.key}
              href={`${basePath}/${cell.key}`}
              data-testid={`calendar-cell-${cell.key}`}
              className={`${cellClass} hover:bg-muted/40 transition`}
            >
              {content}
            </Link>
          ) : (
            <div key={cell.key} data-testid={`calendar-cell-${cell.key}`} className={cellClass}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function monthLabel(year: number, month: number, _copy: BookingCalendarCopy): string {
  // Render in the browser/server locale via Intl — independent of
  // the translated weekday strings.
  const d = new Date(Date.UTC(year, month, 1));
  return `${d.toLocaleString('default', { month: 'long' })} ${year}`;
}
