import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { auditLogsRepo, bookingsRepo, resetStore } from '@/lib/data';
import {
  bookingCancellationEmail,
  bookingConfirmedEmail,
  bookingCustomerConfirmationEmail,
  bookingOwnerNotificationEmail,
  bookingReminderEmail,
} from '@/lib/notifications/email-templates/bookings';
import {
  createPublicBooking,
  fetchPublicSlots,
} from '@/app/(i18n)/[locale]/sites/[slug]/boek/actions';
import type { Booking, Tenant } from '@/types/database';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VILLA_SLUG = 'demo-villa';

function fakeTenant(): Tenant {
  return {
    id: VILLA_TENANT_ID,
    name: 'Demo Villa Curaçao',
    slug: 'demo-villa',
    status: 'live',
  } as Tenant;
}

function fakeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b-1',
    tenant_id: VILLA_TENANT_ID,
    status: 'pending',
    start_date: '2026-06-20',
    end_date: '2026-06-20',
    persons: 2,
    guest_name: 'Test Klant',
    guest_email: 'test@example.com',
    guest_phone: null,
    total_price_cents: 0,
    currency: 'EUR',
    payment_status: 'unpaid',
    payment_provider: null,
    payment_reference: null,
    notes: null,
    booking_type: 'time_slot',
    start_time: '2026-06-20T18:00:00.000Z',
    end_time: '2026-06-20T19:30:00.000Z',
    party_size: 2,
    customer_name: 'Test Klant',
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

describe('booking email templates (step 52)', () => {
  describe('bookingCustomerConfirmationEmail', () => {
    it('NL subject contains the tenant name', () => {
      const tpl = bookingCustomerConfirmationEmail(fakeBooking(), fakeTenant(), 'nl');
      expect(tpl.subject).toContain('Demo Villa Curaçao');
      expect(tpl.subject).toContain('Reservering ontvangen');
    });

    it('FR subject is localised', () => {
      const tpl = bookingCustomerConfirmationEmail(fakeBooking(), fakeTenant(), 'fr');
      expect(tpl.subject).toContain('Réservation');
    });

    it('EN subject is localised', () => {
      const tpl = bookingCustomerConfirmationEmail(fakeBooking(), fakeTenant(), 'en');
      expect(tpl.subject).toContain('Reservation received');
    });

    it('body includes the reference code', () => {
      const tpl = bookingCustomerConfirmationEmail(fakeBooking(), fakeTenant(), 'nl');
      expect(tpl.body).toContain('BK-2026-0042');
    });

    it("body addresses the customer by name", () => {
      const tpl = bookingCustomerConfirmationEmail(fakeBooking(), fakeTenant(), 'nl');
      expect(tpl.body).toContain('Test Klant');
    });

    it('singular guest label for party_size=1', () => {
      const tpl = bookingCustomerConfirmationEmail(
        fakeBooking({ party_size: 1, persons: 1 }),
        fakeTenant(),
        'nl'
      );
      expect(tpl.body).toContain('1 persoon');
    });

    it('plural guest label for party_size > 1', () => {
      const tpl = bookingCustomerConfirmationEmail(
        fakeBooking({ party_size: 4, persons: 4 }),
        fakeTenant(),
        'nl'
      );
      expect(tpl.body).toContain('4 personen');
    });

    it("includes customer's notes when present", () => {
      const tpl = bookingCustomerConfirmationEmail(
        fakeBooking({ notes: 'Glutenvrij dieet' }),
        fakeTenant(),
        'nl'
      );
      expect(tpl.body).toContain('Glutenvrij dieet');
    });
  });

  describe('bookingOwnerNotificationEmail', () => {
    it('subject contains the reference code', () => {
      const tpl = bookingOwnerNotificationEmail(fakeBooking(), fakeTenant(), 'nl');
      expect(tpl.subject).toContain('BK-2026-0042');
    });

    it('body shows the customer email for inbox-reachability', () => {
      const tpl = bookingOwnerNotificationEmail(fakeBooking(), fakeTenant(), 'nl');
      expect(tpl.body).toContain('test@example.com');
    });

    it('body omits phone line when phone is null', () => {
      const tpl = bookingOwnerNotificationEmail(fakeBooking(), fakeTenant(), 'nl');
      expect(tpl.body).not.toContain('Telefoon');
    });

    it('body includes phone line when phone is provided', () => {
      const tpl = bookingOwnerNotificationEmail(
        fakeBooking({ customer_phone: '+31 6 12345678' }),
        fakeTenant(),
        'nl'
      );
      expect(tpl.body).toContain('+31 6 12345678');
    });
  });

  describe('bookingConfirmedEmail', () => {
    it('subject mentions confirmation in NL', () => {
      const tpl = bookingConfirmedEmail(fakeBooking({ status: 'confirmed' }), fakeTenant(), 'nl');
      expect(tpl.subject).toContain('bevestigd');
    });

    it('subject is localised in EN', () => {
      const tpl = bookingConfirmedEmail(fakeBooking({ status: 'confirmed' }), fakeTenant(), 'en');
      expect(tpl.subject).toContain('confirmed');
    });
  });

  describe('bookingCancellationEmail', () => {
    it('body includes the cancellation reason when provided', () => {
      const tpl = bookingCancellationEmail(
        fakeBooking({ status: 'cancelled', cancellation_reason: 'Storm op komst' }),
        fakeTenant(),
        'nl'
      );
      expect(tpl.body).toContain('Storm op komst');
    });

    it('omits the reason line when no cancellation_reason', () => {
      const tpl = bookingCancellationEmail(
        fakeBooking({ status: 'cancelled', cancellation_reason: null }),
        fakeTenant(),
        'nl'
      );
      expect(tpl.body).not.toContain('Reden:');
    });
  });

  describe('bookingReminderEmail', () => {
    it('mentions reminder + tenant name', () => {
      const tpl = bookingReminderEmail(fakeBooking(), fakeTenant(), 'nl');
      expect(tpl.subject).toContain('Demo Villa Curaçao');
      expect(tpl.subject).toContain('Herinnering');
    });
  });

  describe('createPublicBooking wires queueEmail (audit-trail check)', () => {
    beforeEach(() => resetStore());
    afterEach(() => resetStore());

    it('emits one email_queued audit per recipient on a successful booking', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: '2026-06-15',
        partySize: 2,
      });
      expect(slots.length).toBeGreaterThan(0);
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'test@example.com',
        party_size: 2,
        start_time: slots[0].start_time,
      });
      expect(result.success).toBe(true);
      const auditEntries = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, { limit: 100 });
      const emailEvents = auditEntries.filter((e) => e.action === 'email_queued');
      // 1 customer + 1 owner = 2 entries for the create flow.
      expect(emailEvents.length).toBeGreaterThanOrEqual(2);
      const recipients = emailEvents.map((e) => (e.metadata as { recipient?: string }).recipient);
      expect(recipients).toContain('customer');
      expect(recipients).toContain('owner');
    });

    it('persists the customer email audit metadata with reference + booking id', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: '2026-06-15',
        partySize: 2,
      });
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'audit-trail@example.com',
        party_size: 2,
        start_time: slots[0].start_time,
      });
      expect(result.success).toBe(true);
      const booking = await bookingsRepo.findByReferenceCode(result.bookingReference!);
      const auditEntries = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, { limit: 100 });
      const customerEvent = auditEntries.find(
        (e) =>
          e.action === 'email_queued' &&
          (e.metadata as { recipient?: string }).recipient === 'customer'
      );
      expect(customerEvent).toBeTruthy();
      expect((customerEvent!.metadata as { reference: string }).reference).toBe(
        booking!.reference_code
      );
      expect((customerEvent!.metadata as { to: string }).to).toBe('audit-trail@example.com');
    });

    it('does not break the booking when no owner is mapped (deletes ownership row first)', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: '2026-06-15',
        partySize: 2,
      });
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'no-owner@example.com',
        party_size: 2,
        start_time: slots[0].start_time,
      });
      expect(result.success).toBe(true);
    });
  });
});
