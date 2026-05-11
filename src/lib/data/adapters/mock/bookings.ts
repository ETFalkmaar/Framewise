import type { Booking, BookingStatus } from '@/types/database';
import {
  bookingInsertSchema,
  bookingUpdateSchema,
  checkBookingAvailability,
  parseOrThrow,
  ValidationError,
  VALIDATION_ERROR_CODES,
} from '@/lib/validation';
import type { BookingsRepository, ListBookingsOptions } from '../../repositories/bookings';
import { generateId, getTimestamp, table } from './store';

function matchStatus(status: BookingStatus, filter: ListBookingsOptions['status']): boolean {
  if (!filter) return true;
  return Array.isArray(filter) ? filter.includes(status) : status === filter;
}

function inRange(start: string, from: string | undefined, to: string | undefined): boolean {
  if (from && start < from) return false;
  if (to && start > to) return false;
  return true;
}

/**
 * Generate a tenant-scoped booking reference code in the
 * `BK-{YYYY}-{4-digit-counter}` format (step 49). Walks the existing
 * bookings for the same year + tenant to find the next counter — fine
 * for the mock adapter; Supabase swap-in (step 119) will replace this
 * with a sequence column.
 */
function nextReferenceCode(tenantId: string, year: number): string {
  let maxCounter = 0;
  for (const b of table('bookings').values()) {
    if (b.tenant_id !== tenantId) continue;
    const match = b.reference_code?.match(/^BK-(\d{4})-(\d+)$/);
    if (!match) continue;
    if (Number(match[1]) !== year) continue;
    const n = Number(match[2]);
    if (n > maxCounter) maxCounter = n;
  }
  const next = String(maxCounter + 1).padStart(4, '0');
  return `BK-${year}-${next}`;
}

export const mockBookingsRepo: BookingsRepository = {
  async findById(id) {
    return table('bookings').get(id) ?? null;
  },

  async findByReferenceCode(code) {
    for (const b of table('bookings').values()) {
      if (b.reference_code === code) return b;
    }
    return null;
  },

  async listByTenant(tenantId, options) {
    const limit = options?.limit;
    let rows = Array.from(table('bookings').values())
      .filter((b) => b.tenant_id === tenantId)
      .filter((b) => matchStatus(b.status, options?.status))
      .filter((b) => inRange(b.start_time, options?.from, options?.to))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (typeof limit === 'number') rows = rows.slice(0, limit);
    return rows;
  },

  async listByDate(tenantId, date) {
    // `date` is YYYY-MM-DD; match any booking whose `start_time` falls
    // in that calendar day (UTC for now — timezone-aware filtering
    // lands when slot generation arrives in step 50).
    const from = `${date}T00:00:00.000Z`;
    const to = `${date}T23:59:59.999Z`;
    return Array.from(table('bookings').values())
      .filter((b) => b.tenant_id === tenantId)
      .filter((b) => b.start_time >= from && b.start_time <= to)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  },

  async countByTenantInRange(tenantId, from, to) {
    let n = 0;
    for (const b of table('bookings').values()) {
      if (b.tenant_id !== tenantId) continue;
      if (b.start_time >= from && b.start_time < to) n++;
    }
    return n;
  },

  async listAvailability(tenantId, fromDate, toDate) {
    return Array.from(table('availability').values())
      .filter((a) => a.tenant_id === tenantId && a.date >= fromDate && a.date <= toDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async create(data) {
    const parsed = parseOrThrow(bookingInsertSchema, data, 'Invalid booking input');
    const availability = await checkBookingAvailability(
      parsed.tenant_id,
      parsed.start_date,
      parsed.end_date
    );
    if (!availability.ok) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.BOOKING_CONFLICT,
        `Booking conflicts with ${availability.conflicts.length} existing booking(s) and ${availability.blockedDates.length} blocked date(s)`,
        {
          field: 'start_date',
          issues: [
            ...availability.conflicts.map((c) => ({
              path: `conflict:${c.id}`,
              message: `${c.start_date} → ${c.end_date} (${c.status})`,
            })),
            ...availability.blockedDates.map((d) => ({
              path: 'blocked',
              message: d,
            })),
          ],
        }
      );
    }
    const now = getTimestamp();
    const year = new Date(now).getUTCFullYear();
    // Step 49 — fill in the new lifecycle / time-slot fields with
    // sensible defaults derived from the legacy nights fields when the
    // caller doesn't supply them.
    const bookingType = data.booking_type ?? 'all_day';
    const startTime = data.start_time ?? `${parsed.start_date}T00:00:00.000Z`;
    const endTime = data.end_time ?? `${parsed.end_date}T00:00:00.000Z`;
    const row: Booking = {
      ...parsed,
      id: generateId(),
      created_at: now,
      updated_at: now,
      booking_type: bookingType,
      start_time: startTime,
      end_time: endTime,
      party_size: data.party_size ?? parsed.persons,
      customer_name: data.customer_name ?? parsed.guest_name,
      customer_email: data.customer_email ?? parsed.guest_email,
      customer_phone: data.customer_phone ?? parsed.guest_phone,
      internal_notes: data.internal_notes ?? null,
      reference_code: nextReferenceCode(parsed.tenant_id, year),
      confirmed_at: parsed.status === 'confirmed' ? now : null,
      cancelled_at: parsed.status === 'cancelled' ? now : null,
      cancellation_reason: null,
      no_show_at: null,
    };
    table('bookings').set(row.id, row);
    return row;
  },

  async update(id, data) {
    const existing = table('bookings').get(id);
    if (!existing) {
      throw new ValidationError(VALIDATION_ERROR_CODES.NOT_FOUND, `bookings: ${id} not found`);
    }
    const parsed = parseOrThrow(bookingUpdateSchema, data, 'Invalid booking update');
    const updated: Booking = {
      ...existing,
      ...parsed,
      id,
      updated_at: getTimestamp(),
    };
    table('bookings').set(id, updated);
    return updated;
  },

  async cancel(id) {
    return this.update(id, { status: 'cancelled', cancelled_at: getTimestamp() });
  },

  async confirm(id) {
    return this.update(id, { status: 'confirmed', confirmed_at: getTimestamp() });
  },
};
