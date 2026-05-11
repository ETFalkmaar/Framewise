import type { Booking } from '@/types/database';

/**
 * Customer self-service eligibility guards (step 54, fase 14
 * part 6/7).
 *
 * Two policies — kept on a single module so the admin UI, the
 * server actions, and the lookup page all agree on what's allowed:
 *
 *  - **Cancel** requires the booking still to be in `pending` or
 *    `confirmed`, AND its start_time to be at least 2 hours in the
 *    future. This gives the tenant time to free the slot for someone
 *    else without leaving them in the lurch.
 *  - **Reschedule** is stricter — 4 hours of runway so the slot
 *    generator can offer alternatives at a usable cadence.
 *
 * Both helpers return `{ allowed, reason? }` so the UI can render a
 * localised disabled-state message without re-deriving the gate.
 */

export type CancelDenial =
  | 'wrong_status'
  | 'past_booking'
  | 'too_close'
  | 'already_cancelled';

export type RescheduleDenial = CancelDenial;

export interface ModificationCheck<TReason extends string = string> {
  allowed: boolean;
  reason?: TReason;
}

const CANCEL_MIN_HOURS_AHEAD = 2;
const RESCHEDULE_MIN_HOURS_AHEAD = 4;
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Can the booking still be cancelled by the customer (no login)?
 */
export function canCustomerCancel(
  booking: Booking,
  now: Date = new Date()
): ModificationCheck<CancelDenial> {
  if (booking.status === 'cancelled') {
    return { allowed: false, reason: 'already_cancelled' };
  }
  if (booking.status === 'completed' || booking.status === 'no_show') {
    return { allowed: false, reason: 'wrong_status' };
  }
  const start = new Date(booking.start_time).getTime();
  if (Number.isNaN(start)) return { allowed: false, reason: 'wrong_status' };
  if (start <= now.getTime()) return { allowed: false, reason: 'past_booking' };
  if (start - now.getTime() < CANCEL_MIN_HOURS_AHEAD * MS_PER_HOUR) {
    return { allowed: false, reason: 'too_close' };
  }
  return { allowed: true };
}

/**
 * Can the booking still be rescheduled by the customer?
 */
export function canCustomerReschedule(
  booking: Booking,
  now: Date = new Date()
): ModificationCheck<RescheduleDenial> {
  if (booking.status === 'cancelled') {
    return { allowed: false, reason: 'already_cancelled' };
  }
  if (booking.status === 'completed' || booking.status === 'no_show') {
    return { allowed: false, reason: 'wrong_status' };
  }
  const start = new Date(booking.start_time).getTime();
  if (Number.isNaN(start)) return { allowed: false, reason: 'wrong_status' };
  if (start <= now.getTime()) return { allowed: false, reason: 'past_booking' };
  if (start - now.getTime() < RESCHEDULE_MIN_HOURS_AHEAD * MS_PER_HOUR) {
    return { allowed: false, reason: 'too_close' };
  }
  return { allowed: true };
}
