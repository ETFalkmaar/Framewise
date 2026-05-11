import type { BookingException } from '@/types/database';
import type { BookingExceptionsRepository } from '../../repositories/booking-exceptions';
import { generateId, getTimestamp, table } from './store';

export const mockBookingExceptionsRepo: BookingExceptionsRepository = {
  async listByTenant(tenantId, options) {
    return Array.from(table('booking_exceptions').values())
      .filter((e) => e.tenant_id === tenantId)
      .filter((e) => (options?.from ? e.date >= options.from : true))
      .filter((e) => (options?.to ? e.date <= options.to : true))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async findByDate(tenantId, date) {
    for (const e of table('booking_exceptions').values()) {
      if (e.tenant_id === tenantId && e.date === date) return e;
    }
    return null;
  },

  async findById(id) {
    return table('booking_exceptions').get(id) ?? null;
  },

  async create(data) {
    const row: BookingException = {
      ...data,
      id: generateId(),
      created_at: getTimestamp(),
    };
    table('booking_exceptions').set(row.id, row);
    return row;
  },

  async delete(id) {
    if (!table('booking_exceptions').delete(id)) {
      throw new Error(`booking_exceptions: ${id} not found`);
    }
  },
};
