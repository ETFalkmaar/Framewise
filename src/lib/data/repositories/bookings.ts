import type { Availability, Booking, BookingStatus } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface ListBookingsOptions {
  /** ISO datetime — inclusive lower bound on `start_time`. */
  from?: string;
  /** ISO datetime — inclusive upper bound on `start_time`. */
  to?: string;
  status?: BookingStatus | BookingStatus[];
  limit?: number;
}

export interface BookingsRepository {
  findById(id: string): Promise<Booking | null>;
  findByReferenceCode(code: string): Promise<Booking | null>;
  listByTenant(tenantId: string, options?: ListBookingsOptions): Promise<Booking[]>;
  /** Step 49 — bookings whose `start_time` falls on the given local
   *  date (YYYY-MM-DD). Used by the day-detail page. */
  listByDate(tenantId: string, date: string): Promise<Booking[]>;
  /** Step 49 — count bookings whose `start_time` falls in the half-open
   *  range `[from, to)`. Used by the month calendar for the per-day
   *  count badge. */
  countByTenantInRange(tenantId: string, from: string, to: string): Promise<number>;
  listAvailability(tenantId: string, fromDate: string, toDate: string): Promise<Availability[]>;
  create(
    data: Omit<
      Booking,
      | 'id'
      | 'created_at'
      | 'updated_at'
      | 'reference_code'
      | 'booking_type'
      | 'start_time'
      | 'end_time'
      | 'party_size'
      | 'customer_name'
      | 'customer_email'
      | 'customer_phone'
      | 'internal_notes'
      | 'confirmed_at'
      | 'cancelled_at'
      | 'cancellation_reason'
      | 'no_show_at'
    > & Partial<Pick<Booking, 'booking_type' | 'start_time' | 'end_time' | 'party_size' | 'customer_name' | 'customer_email' | 'customer_phone' | 'internal_notes'>>
  ): Promise<Booking>;
  update(id: string, data: Partial<Booking>): Promise<Booking>;
  cancel(id: string): Promise<Booking>;
  confirm(id: string): Promise<Booking>;
}

const { proxy, set } = createRepoProxy<BookingsRepository>('bookingsRepo');
export const bookingsRepo = proxy;
export const setBookingsRepo = set;
