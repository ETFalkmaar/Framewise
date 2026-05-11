import { describe, expect, it } from 'vitest';

import { canCustomerCancel, canCustomerReschedule } from '@/lib/bookings/can-modify';
import type { Booking } from '@/types/database';

const NOW = new Date('2026-06-15T12:00:00.000Z');

function fakeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b-1',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    status: 'pending',
    start_date: '2026-06-15',
    end_date: '2026-06-15',
    persons: 2,
    guest_name: 'Test',
    guest_email: 'test@example.com',
    guest_phone: null,
    total_price_cents: 0,
    currency: 'EUR',
    payment_status: 'unpaid',
    payment_provider: null,
    payment_reference: null,
    notes: null,
    booking_type: 'time_slot',
    start_time: '2026-06-16T18:00:00.000Z', // ~30h ahead of NOW by default
    end_time: '2026-06-16T19:30:00.000Z',
    party_size: 2,
    customer_name: 'Test',
    customer_email: 'test@example.com',
    customer_phone: null,
    internal_notes: null,
    reference_code: 'BK-2026-0042',
    confirmed_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    no_show_at: null,
    created_at: '2026-05-01T10:00:00.000Z',
    updated_at: '2026-05-01T10:00:00.000Z',
    ...overrides,
  } as Booking;
}

describe('canCustomerCancel (step 54)', () => {
  it('allows a pending booking comfortably in the future', () => {
    const r = canCustomerCancel(fakeBooking(), NOW);
    expect(r.allowed).toBe(true);
  });

  it('allows a confirmed booking comfortably in the future', () => {
    const r = canCustomerCancel(fakeBooking({ status: 'confirmed' }), NOW);
    expect(r.allowed).toBe(true);
  });

  it('rejects an already-cancelled booking with `already_cancelled`', () => {
    const r = canCustomerCancel(fakeBooking({ status: 'cancelled' }), NOW);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('already_cancelled');
  });

  it('rejects a completed booking with `wrong_status`', () => {
    const r = canCustomerCancel(fakeBooking({ status: 'completed' }), NOW);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('wrong_status');
  });

  it('rejects a no_show booking', () => {
    const r = canCustomerCancel(fakeBooking({ status: 'no_show' }), NOW);
    expect(r.allowed).toBe(false);
  });

  it('rejects a booking less than 2h ahead with `too_close`', () => {
    const r = canCustomerCancel(
      fakeBooking({ start_time: '2026-06-15T13:30:00.000Z' }), // 1.5h ahead
      NOW
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('too_close');
  });

  it('rejects a past booking with `past_booking`', () => {
    const r = canCustomerCancel(
      fakeBooking({ start_time: '2026-06-14T12:00:00.000Z' }), // 24h ago
      NOW
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('past_booking');
  });

  it('rejects a booking with a malformed start_time as `wrong_status`', () => {
    const r = canCustomerCancel(fakeBooking({ start_time: 'not-a-date' }), NOW);
    expect(r.allowed).toBe(false);
  });
});

describe('canCustomerReschedule (step 54)', () => {
  it('allows a booking > 4h ahead', () => {
    const r = canCustomerReschedule(fakeBooking(), NOW);
    expect(r.allowed).toBe(true);
  });

  it('rejects a booking 3h ahead — needs 4h runway', () => {
    const r = canCustomerReschedule(
      fakeBooking({ start_time: '2026-06-15T15:00:00.000Z' }), // 3h ahead
      NOW
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('too_close');
  });

  it('rejects a cancelled booking', () => {
    const r = canCustomerReschedule(fakeBooking({ status: 'cancelled' }), NOW);
    expect(r.allowed).toBe(false);
  });

  it('rejects a no_show booking', () => {
    const r = canCustomerReschedule(fakeBooking({ status: 'no_show' }), NOW);
    expect(r.allowed).toBe(false);
  });

  it('rejects a past booking', () => {
    const r = canCustomerReschedule(fakeBooking({ start_time: '2026-06-14T12:00:00.000Z' }), NOW);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('past_booking');
  });
});
