import type { BookingException } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface ListBookingExceptionsOptions {
  /** Inclusive YYYY-MM-DD lower bound on `date`. */
  from?: string;
  /** Inclusive YYYY-MM-DD upper bound. */
  to?: string;
}

export interface BookingExceptionsRepository {
  listByTenant(
    tenantId: string,
    options?: ListBookingExceptionsOptions
  ): Promise<BookingException[]>;
  findByDate(tenantId: string, date: string): Promise<BookingException | null>;
  findById(id: string): Promise<BookingException | null>;
  create(data: Omit<BookingException, 'id' | 'created_at'>): Promise<BookingException>;
  delete(id: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<BookingExceptionsRepository>('bookingExceptionsRepo');
export const bookingExceptionsRepo = proxy;
export const setBookingExceptionsRepo = set;
