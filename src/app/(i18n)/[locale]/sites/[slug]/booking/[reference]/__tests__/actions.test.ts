import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Shared in-memory cookie store — mirrors the preview-cookie test
// pattern so the actions can read/write through a mocked
// `next/headers` API without booting a Next.js runtime.
interface CookieOptions {
  name: string;
  value: string;
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none' | boolean;
  maxAge?: number;
  path?: string;
  secure?: boolean;
}

const cookieStore = vi.hoisted(() => {
  const map = new Map<string, string>();
  return {
    map,
    get: vi.fn((name: string) => {
      const value = map.get(name);
      return value === undefined ? undefined : { name, value };
    }),
    set: vi.fn((nameOrOpts: string | CookieOptions, value?: string, _opts?: CookieOptions) => {
      if (typeof nameOrOpts === 'string') {
        map.set(nameOrOpts, value ?? '');
      } else {
        map.set(nameOrOpts.name, nameOrOpts.value);
      }
    }),
    delete: vi.fn((name: string) => {
      map.delete(name);
    }),
  };
});

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieStore),
}));

import '@/lib/data';

import { auditLogsRepo, bookingsRepo, resetStore } from '@/lib/data';
import {
  createPublicBooking,
  fetchPublicSlots,
} from '@/app/(i18n)/[locale]/sites/[slug]/boek/actions';
import {
  customerCancelBooking,
  customerRescheduleBooking,
  verifyBookingEmail,
} from '@/app/(i18n)/[locale]/sites/[slug]/booking/[reference]/actions';

const VILLA_SLUG = 'demo-villa';
const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';

async function makeBookingFarOut() {
  // Create a booking on 2026-06-15 — the seed villa has the diner
  // service active that day, and the date is well past the 4h
  // reschedule guard from any test run time.
  const slots = await fetchPublicSlots({
    tenantSlug: VILLA_SLUG,
    date: '2026-06-15',
    partySize: 2,
  });
  const result = await createPublicBooking({
    tenantSlug: VILLA_SLUG,
    customer_name: 'Self Service Test',
    customer_email: 'self@example.com',
    party_size: 2,
    start_time: slots[0].start_time,
  });
  expect(result.success).toBe(true);
  const booking = await bookingsRepo.findByReferenceCode(result.bookingReference!);
  return { booking: booking!, slots };
}

describe('customer self-service actions (step 54)', () => {
  beforeEach(() => {
    resetStore();
    cookieStore.map.clear();
  });
  afterEach(() => {
    resetStore();
    cookieStore.map.clear();
  });

  describe('verifyBookingEmail', () => {
    it('happy path sets the booking_verified cookie', async () => {
      const { booking } = await makeBookingFarOut();
      const r = await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        email: 'self@example.com',
      });
      expect(r.success).toBe(true);
      expect(cookieStore.map.get(`booking_verified_${booking.reference_code}`)).toBe('true');
    });

    it('matches email case-insensitively', async () => {
      const { booking } = await makeBookingFarOut();
      const r = await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        email: 'SELF@EXAMPLE.COM',
      });
      expect(r.success).toBe(true);
    });

    it('rejects mismatched email with email_mismatch', async () => {
      const { booking } = await makeBookingFarOut();
      const r = await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        email: 'someone-else@example.com',
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('email_mismatch');
    });

    it('returns not_found for an unknown reference', async () => {
      const r = await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: 'BK-9999-9999',
        email: 'self@example.com',
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('not_found');
    });

    it('writes a booking_email_verified audit entry on success', async () => {
      const { booking } = await makeBookingFarOut();
      await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        email: 'self@example.com',
      });
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, { limit: 100 });
      expect(audits.some((a) => a.action === 'booking_email_verified')).toBe(true);
    });
  });

  describe('customerCancelBooking', () => {
    it('without verify cookie returns forbidden', async () => {
      const { booking } = await makeBookingFarOut();
      const r = await customerCancelBooking({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('forbidden');
    });

    it('happy path cancels the booking after verify', async () => {
      const { booking } = await makeBookingFarOut();
      await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        email: 'self@example.com',
      });
      const r = await customerCancelBooking({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        reason: 'Plans changed',
      });
      expect(r.success).toBe(true);
      const after = await bookingsRepo.findById(booking.id);
      expect(after?.status).toBe('cancelled');
      expect(after?.cancellation_reason).toBe('Plans changed');
    });

    it('emits a booking_cancelled_by_customer audit entry', async () => {
      const { booking } = await makeBookingFarOut();
      await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        email: 'self@example.com',
      });
      await customerCancelBooking({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
      });
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, { limit: 100 });
      expect(audits.some((a) => a.action === 'booking_cancelled_by_customer')).toBe(true);
    });

    it("rejects when the booking already happened in the past", async () => {
      // Create one via repo directly with a past start_time.
      const past = await bookingsRepo.create({
        tenant_id: VILLA_TENANT_ID,
        status: 'pending',
        start_date: '2020-01-01',
        end_date: '2020-01-01',
        persons: 2,
        guest_name: 'Past',
        guest_email: 'past@example.com',
        guest_phone: null,
        total_price_cents: 0,
        currency: 'EUR',
        payment_status: 'unpaid',
        payment_provider: null,
        payment_reference: null,
        notes: null,
        booking_type: 'time_slot',
        start_time: '2020-01-01T18:00:00.000Z',
        end_time: '2020-01-01T19:30:00.000Z',
        party_size: 2,
        customer_name: 'Past',
        customer_email: 'past@example.com',
        customer_phone: null,
        internal_notes: null,
      });
      await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: past.reference_code,
        email: 'past@example.com',
      });
      const r = await customerCancelBooking({
        tenantSlug: VILLA_SLUG,
        reference: past.reference_code,
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('past_booking');
    });

    it('returns already_cancelled if the booking is already cancelled', async () => {
      const { booking } = await makeBookingFarOut();
      await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        email: 'self@example.com',
      });
      await customerCancelBooking({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
      });
      const r2 = await customerCancelBooking({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
      });
      expect(r2.success).toBe(false);
      expect(r2.error).toBe('already_cancelled');
    });
  });

  describe('customerRescheduleBooking', () => {
    it('without verify cookie returns forbidden', async () => {
      const { booking } = await makeBookingFarOut();
      const r = await customerRescheduleBooking({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        newStartTime: '2026-06-16T18:00:00.000Z',
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('forbidden');
    });

    it('happy path creates a new booking and cancels the old one with reason=rescheduled', async () => {
      const { booking, slots } = await makeBookingFarOut();
      await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        email: 'self@example.com',
      });
      // Pick a different slot on the same day for the reschedule
      // target. slots[1] is 1h45 later than slots[0] so it doesn't
      // collide with the just-created booking on slots[0].
      const newSlot = slots[1];
      const r = await customerRescheduleBooking({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        newStartTime: newSlot.start_time,
      });
      expect(r.success).toBe(true);
      expect(r.newReference).toBeTruthy();
      const oldAfter = await bookingsRepo.findById(booking.id);
      expect(oldAfter?.status).toBe('cancelled');
      expect(oldAfter?.cancellation_reason).toBe('rescheduled');
      const newBooking = await bookingsRepo.findByReferenceCode(r.newReference!);
      expect(newBooking).toBeTruthy();
      expect(newBooking?.start_time).toBe(newSlot.start_time);
      expect(newBooking?.status).toBe('pending');
      expect(newBooking?.customer_email).toBe('self@example.com');
    });

    it('emits booking_rescheduled_by_customer audit linking old + new references', async () => {
      const { booking, slots } = await makeBookingFarOut();
      await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        email: 'self@example.com',
      });
      const r = await customerRescheduleBooking({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        newStartTime: slots[1].start_time,
      });
      expect(r.success).toBe(true);
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, { limit: 100 });
      const event = audits.find((a) => a.action === 'booking_rescheduled_by_customer');
      expect(event).toBeTruthy();
      const meta = event!.metadata as {
        oldReference: string;
        newReference: string;
      };
      expect(meta.oldReference).toBe(booking.reference_code);
      expect(meta.newReference).toBe(r.newReference);
    });

    it("emits an email_queued audit on success", async () => {
      const { booking, slots } = await makeBookingFarOut();
      await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        email: 'self@example.com',
      });
      await customerRescheduleBooking({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        newStartTime: slots[1].start_time,
      });
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, { limit: 100 });
      const rescheduleEmails = audits.filter(
        (a) =>
          a.action === 'email_queued' &&
          (a.metadata as { event?: string }).event === 'booking_rescheduled_by_customer'
      );
      expect(rescheduleEmails.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects if the requested slot is no longer available', async () => {
      const { booking } = await makeBookingFarOut();
      await verifyBookingEmail({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        email: 'self@example.com',
      });
      // Time that doesn't match any slot the generator produces.
      const r = await customerRescheduleBooking({
        tenantSlug: VILLA_SLUG,
        reference: booking.reference_code,
        newStartTime: '2026-06-15T03:14:00.000Z',
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('slot_not_available');
    });
  });
});
