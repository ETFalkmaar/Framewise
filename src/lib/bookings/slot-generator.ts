import {
  availabilityRulesRepo,
  bookingExceptionsRepo,
  bookingsRepo,
} from '@/lib/data';
import type { AvailabilityRule, DayOfWeek } from '@/types/database';

export interface BookingSlot {
  /** ISO datetime (UTC) — start of the slot. */
  start_time: string;
  /** ISO datetime (UTC) — end of the slot. */
  end_time: string;
  /** How many bookings can still fit at this slot. */
  capacity_remaining: number;
  rule_id: string;
  rule_name: string;
}

export interface GenerateSlotsInput {
  tenantId: string;
  /** YYYY-MM-DD — interpreted in UTC for slot timestamps. */
  date: string;
  /** Optional filter — only return slots whose `max_party_size >= partySize`. */
  partySize?: number;
}

/**
 * Slot generator (step 50, fase 14 part 2/7). Turns the tenant's
 * weekly availability rules + per-date exceptions into a flat list
 * of bookable time-slots for the requested date.
 *
 * Rule of precedence:
 *  1. If a `BookingException` exists for the date AND it's `is_closed: true`
 *     → return `[]`.
 *  2. If the exception has `custom_start_time` / `custom_end_time` → the
 *     custom window overrides every matching rule's window.
 *  3. Else: each active rule matching the date's `day_of_week` produces
 *     slots from `start_time` to `end_time` at `slot_duration + buffer`
 *     intervals.
 *
 * Capacity: counts pending + confirmed bookings whose
 * [start_time, end_time) overlaps the slot window and subtracts from
 * `max_concurrent_bookings`. Slots with 0 remaining are dropped.
 *
 * All times are computed in UTC for the mock adapter — timezone-aware
 * generation lands when the Supabase swap (step 119) and `booking_timezone`
 * are wired together.
 */
export async function generateSlotsForDate(input: GenerateSlotsInput): Promise<BookingSlot[]> {
  const { tenantId, date, partySize } = input;

  // 1. Exception check — short-circuit on full closure.
  const exception = await bookingExceptionsRepo.findByDate(tenantId, date);
  if (exception?.is_closed) return [];

  // 2. Day-of-week from the requested date (interpreted in UTC).
  const dayDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(dayDate.getTime())) return [];
  const dayOfWeek = dayDate.getUTCDay() as DayOfWeek;

  // 3. Gather applicable rules.
  const activeRules = await availabilityRulesRepo.listActive(tenantId);
  let rules = activeRules.filter((r) => r.day_of_week === dayOfWeek);

  // 4. Effective date range.
  rules = rules.filter((r) => withinEffectiveRange(r, date));

  // 5. Party-size filter.
  if (typeof partySize === 'number') {
    rules = rules.filter((r) => r.max_party_size >= partySize);
  }

  if (rules.length === 0) return [];

  // 6. Fetch the day's existing bookings once.
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  const dayBookings = await bookingsRepo.listByTenant(tenantId, {
    from: dayStart,
    to: dayEnd,
    status: ['pending', 'confirmed'],
  });

  // 7. Walk each rule, generate slots, count overlaps.
  const slots: BookingSlot[] = [];
  for (const rule of rules) {
    const effectiveStart = exception?.custom_start_time ?? rule.start_time;
    const effectiveEnd = exception?.custom_end_time ?? rule.end_time;

    const windowStart = combineDateAndHHmm(date, effectiveStart);
    const windowEnd = combineDateAndHHmm(date, effectiveEnd);
    if (windowEnd <= windowStart) continue;

    const slotMs = rule.slot_duration_minutes * 60_000;
    const stepMs = slotMs + rule.buffer_minutes * 60_000;
    if (slotMs <= 0 || stepMs <= 0) continue;

    let cursor = windowStart;
    while (cursor + slotMs <= windowEnd) {
      const slotStartIso = new Date(cursor).toISOString();
      const slotEndIso = new Date(cursor + slotMs).toISOString();

      // Count overlapping bookings.
      let overlap = 0;
      for (const b of dayBookings) {
        if (b.start_time < slotEndIso && b.end_time > slotStartIso) overlap++;
      }
      const capacityRemaining = Math.max(0, rule.max_concurrent_bookings - overlap);
      if (capacityRemaining > 0) {
        slots.push({
          start_time: slotStartIso,
          end_time: slotEndIso,
          capacity_remaining: capacityRemaining,
          rule_id: rule.id,
          rule_name: rule.name,
        });
      }

      cursor += stepMs;
    }
  }

  slots.sort((a, b) => a.start_time.localeCompare(b.start_time));
  return slots;
}

function withinEffectiveRange(rule: AvailabilityRule, date: string): boolean {
  if (rule.effective_from && date < rule.effective_from) return false;
  if (rule.effective_until && date > rule.effective_until) return false;
  return true;
}

function combineDateAndHHmm(date: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => Number(n));
  const dt = new Date(`${date}T00:00:00.000Z`);
  dt.setUTCHours(h, m, 0, 0);
  return dt.getTime();
}
