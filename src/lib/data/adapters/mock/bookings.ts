import type { Booking } from '@/types/database';
import {
  bookingInsertSchema,
  bookingUpdateSchema,
  checkBookingAvailability,
  parseOrThrow,
  ValidationError,
  VALIDATION_ERROR_CODES,
} from '@/lib/validation';
import type { BookingsRepository } from '../../repositories/bookings';
import { generateId, getTimestamp, table } from './store';

export const mockBookingsRepo: BookingsRepository = {
  async findById(id) {
    return table('bookings').get(id) ?? null;
  },
  async listByTenant(tenantId) {
    return Array.from(table('bookings').values())
      .filter((b) => b.tenant_id === tenantId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
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
    const row: Booking = {
      ...parsed,
      id: generateId(),
      created_at: now,
      updated_at: now,
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
    return this.update(id, { status: 'cancelled' });
  },
  async confirm(id) {
    return this.update(id, { status: 'confirmed' });
  },
};
