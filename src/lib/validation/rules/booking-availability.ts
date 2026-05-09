import type { Booking } from '@/types/database';
import { bookingsRepo } from '@/lib/data';

export interface BookingAvailabilityResult {
  ok: boolean;
  conflicts: Booking[];
  blockedDates: string[];
}

/**
 * Checks whether a date range is bookable for a given tenant.
 *
 * Detects:
 * - Overlap with existing non-cancelled bookings (excluding the booking
 *   itself, so updates work).
 * - Days marked as `blocked` in the availability table.
 */
export async function checkBookingAvailability(
  tenantId: string,
  startDate: string,
  endDate: string,
  excludeBookingId?: string
): Promise<BookingAvailabilityResult> {
  if (startDate > endDate) {
    return {
      ok: false,
      conflicts: [],
      blockedDates: [],
    };
  }

  const bookings = await bookingsRepo.listByTenant(tenantId);
  const conflicts = bookings.filter((b) => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    if (b.status === 'cancelled') return false;
    return rangesOverlap(b.start_date, b.end_date, startDate, endDate);
  });

  const availability = await bookingsRepo.listAvailability(tenantId, startDate, endDate);
  const blockedDates = availability.filter((a) => a.status === 'blocked').map((a) => a.date);

  return {
    ok: conflicts.length === 0 && blockedDates.length === 0,
    conflicts,
    blockedDates,
  };
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
