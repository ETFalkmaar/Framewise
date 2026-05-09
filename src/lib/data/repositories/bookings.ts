import type { Availability, Booking } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface BookingsRepository {
  findById(id: string): Promise<Booking | null>;
  listByTenant(tenantId: string): Promise<Booking[]>;
  listAvailability(tenantId: string, fromDate: string, toDate: string): Promise<Availability[]>;
  create(data: Omit<Booking, 'id' | 'created_at' | 'updated_at'>): Promise<Booking>;
  update(id: string, data: Partial<Booking>): Promise<Booking>;
  cancel(id: string): Promise<Booking>;
  confirm(id: string): Promise<Booking>;
}

const { proxy, set } = createRepoProxy<BookingsRepository>('bookingsRepo');
export const bookingsRepo = proxy;
export const setBookingsRepo = set;
