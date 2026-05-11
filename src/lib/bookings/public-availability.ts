import { generateSlotsForDate, type BookingSlot } from '@/lib/bookings/slot-generator';

/**
 * Public availability snapshot (step 51, fase 14 part 3/7). One entry
 * per requested calendar day — `slotsCount` lets the public form gray
 * out fully-booked / closed dates before the visitor commits to a
 * specific time. We deliberately don't return the slots themselves
 * from this helper: the customer drills into a day in step 2 of the
 * form and that's when we fetch the actual time-list. Keeps the
 * homepage payload small.
 */
export interface PublicAvailabilityDay {
  /** YYYY-MM-DD — matches the slot-generator's input format. */
  date: string;
  /** True when at least one slot is bookable. */
  isOpen: boolean;
  /** Number of slots available across the day. */
  slotsCount: number;
}

export interface PublicAvailabilityRangeInput {
  tenantId: string;
  /** YYYY-MM-DD inclusive lower bound. */
  from: string;
  /** YYYY-MM-DD inclusive upper bound. */
  to: string;
  partySize?: number;
}

/**
 * Walk every day in `[from, to]` and return a per-day availability
 * snapshot. Designed for the public booking page's date-picker.
 */
export async function getPublicAvailabilityForRange(
  input: PublicAvailabilityRangeInput
): Promise<PublicAvailabilityDay[]> {
  const dates = expandDateRange(input.from, input.to);
  const out: PublicAvailabilityDay[] = [];
  for (const date of dates) {
    const slots = await generateSlotsForDate({
      tenantId: input.tenantId,
      date,
      partySize: input.partySize,
    });
    out.push({
      date,
      isOpen: slots.length > 0,
      slotsCount: slots.length,
    });
  }
  return out;
}

export interface PublicSlotsInput {
  tenantId: string;
  /** YYYY-MM-DD. */
  date: string;
  partySize?: number;
}

/**
 * Thin wrapper around `generateSlotsForDate` so the public form has
 * a single import surface — also gives us a seam to add caching or
 * rate-limiting in step 95 without touching the generator itself.
 */
export async function getSlotsForPublicDate(input: PublicSlotsInput): Promise<BookingSlot[]> {
  return generateSlotsForDate({
    tenantId: input.tenantId,
    date: input.date,
    partySize: input.partySize,
  });
}

/**
 * Expand `YYYY-MM-DD` `from` → `YYYY-MM-DD` `to` inclusive. Returns
 * `[]` for invalid or inverted ranges so callers never crash.
 */
function expandDateRange(from: string, to: string): string[] {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return [];
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    out.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    // Safety belt — generator handles 90 days fine, but if a caller
    // ever passes a year-long range we still terminate.
    if (out.length > 366) break;
  }
  return out;
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}
