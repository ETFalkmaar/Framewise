import type { Booking } from '@/types/database';
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
    const now = getTimestamp();
    const row: Booking = {
      ...data,
      id: generateId(),
      created_at: now,
      updated_at: now,
    };
    table('bookings').set(row.id, row);
    return row;
  },
  async update(id, data) {
    const existing = table('bookings').get(id);
    if (!existing) throw new Error(`bookings: ${id} not found`);
    const updated: Booking = { ...existing, ...data, id, updated_at: getTimestamp() };
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
