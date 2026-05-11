import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { availabilityRulesRepo, bookingExceptionsRepo, bookingsRepo, resetStore } from '@/lib/data';
import {
  getPublicAvailabilityForRange,
  getSlotsForPublicDate,
} from '@/lib/bookings/public-availability';
import {
  createPublicBooking,
  fetchPublicSlots,
} from '@/app/(i18n)/[locale]/sites/[slug]/boek/actions';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VILLA_SLUG = 'demo-villa';
const RESTAURANT_SLUG = 'demo-restaurant';

/**
 * Step 51 — public booking flow tests. Covers both the read-side
 * `getPublicAvailabilityForRange` / `getSlotsForPublicDate` helpers
 * and the write-side `createPublicBooking` action.
 *
 * Why bundle them in one file? They share the seed assumptions
 * (villa has diner + lunch rules, restaurant doesn't have bookings
 * enabled) and the same reset-store hooks.
 */
describe('public booking flow (step 51)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  describe('getPublicAvailabilityForRange', () => {
    it('returns one entry per day in the requested range', async () => {
      const days = await getPublicAvailabilityForRange({
        tenantId: VILLA_TENANT_ID,
        from: '2026-06-15',
        to: '2026-06-21',
      });
      expect(days).toHaveLength(7);
      expect(days[0].date).toBe('2026-06-15');
      expect(days[6].date).toBe('2026-06-21');
    });

    it('flags a closed-exception date as not open', async () => {
      // Seed has 2026-12-25 closed for the villa.
      const days = await getPublicAvailabilityForRange({
        tenantId: VILLA_TENANT_ID,
        from: '2026-12-24',
        to: '2026-12-26',
      });
      const xmas = days.find((d) => d.date === '2026-12-25');
      expect(xmas?.isOpen).toBe(false);
      expect(xmas?.slotsCount).toBe(0);
    });

    it('reports more slots on Saturday (lunch + diner) than on Monday (diner only)', async () => {
      const days = await getPublicAvailabilityForRange({
        tenantId: VILLA_TENANT_ID,
        from: '2026-06-15', // Monday
        to: '2026-06-21', // Sunday
      });
      const mon = days.find((d) => d.date === '2026-06-15')!;
      const sat = days.find((d) => d.date === '2026-06-20')!;
      expect(sat.slotsCount).toBeGreaterThan(mon.slotsCount);
    });

    it('respects partySize filter — large parties = no slots when rules cap is smaller', async () => {
      const days = await getPublicAvailabilityForRange({
        tenantId: VILLA_TENANT_ID,
        from: '2026-06-15',
        to: '2026-06-16',
        partySize: 99,
      });
      for (const d of days) expect(d.isOpen).toBe(false);
    });

    it('returns [] for an inverted date range', async () => {
      const days = await getPublicAvailabilityForRange({
        tenantId: VILLA_TENANT_ID,
        from: '2026-06-20',
        to: '2026-06-15',
      });
      expect(days).toEqual([]);
    });

    it('returns [] for a malformed date string', async () => {
      const days = await getPublicAvailabilityForRange({
        tenantId: VILLA_TENANT_ID,
        from: 'not-a-date',
        to: 'also-bad',
      });
      expect(days).toEqual([]);
    });
  });

  describe('getSlotsForPublicDate', () => {
    it('returns slots inside the diner window on a normal day', async () => {
      const slots = await getSlotsForPublicDate({
        tenantId: VILLA_TENANT_ID,
        date: '2026-06-15',
      });
      expect(slots.length).toBeGreaterThan(0);
      for (const s of slots) {
        expect(s.rule_name).toBe('Diner service');
      }
    });

    it('drops slots smaller than the requested party size', async () => {
      const slots = await getSlotsForPublicDate({
        tenantId: VILLA_TENANT_ID,
        date: '2026-06-15',
        partySize: 7,
      });
      expect(slots).toEqual([]);
    });
  });

  describe('createPublicBooking', () => {
    async function firstSlot() {
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: '2026-06-15',
        partySize: 2,
      });
      expect(slots.length).toBeGreaterThan(0);
      return slots[0];
    }

    it('happy path returns a BK- reference code', async () => {
      const slot = await firstSlot();
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'test@example.com',
        customer_phone: null,
        party_size: 2,
        start_time: slot.start_time,
        notes: null,
      });
      expect(result.success).toBe(true);
      expect(result.bookingReference).toMatch(/^BK-\d{4}-\d+$/);
    });

    it('booked slot shows up in bookingsRepo with status=pending + booking_type=time_slot', async () => {
      const slot = await firstSlot();
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'test@example.com',
        party_size: 2,
        start_time: slot.start_time,
      });
      expect(result.success).toBe(true);
      const created = await bookingsRepo.findByReferenceCode(result.bookingReference!);
      expect(created).not.toBeNull();
      expect(created?.status).toBe('pending');
      expect(created?.booking_type).toBe('time_slot');
      expect(created?.party_size).toBe(2);
      expect(created?.customer_email).toBe('test@example.com');
    });

    it('returns spam_detected when honeypot is filled', async () => {
      const slot = await firstSlot();
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Spam Bot',
        customer_email: 'spam@example.com',
        party_size: 2,
        start_time: slot.start_time,
        honeypot: 'I am a bot',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('spam_detected');
    });

    it('returns validation_failed for invalid email', async () => {
      const slot = await firstSlot();
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'not-an-email',
        party_size: 2,
        start_time: slot.start_time,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('validation_failed');
    });

    it('returns validation_failed for party_size out of range', async () => {
      const slot = await firstSlot();
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'test@example.com',
        party_size: 0, // below min(1)
        start_time: slot.start_time,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('validation_failed');
    });

    it('returns tenant_not_available for a tenant without bookings_enabled', async () => {
      // Demo restaurant ships with bookings_enabled=false.
      const result = await createPublicBooking({
        tenantSlug: RESTAURANT_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'test@example.com',
        party_size: 2,
        start_time: '2026-06-15T18:00:00.000Z',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('tenant_not_available');
    });

    it('returns tenant_not_available for an unknown slug', async () => {
      const result = await createPublicBooking({
        tenantSlug: 'this-slug-does-not-exist',
        customer_name: 'Test Klant',
        customer_email: 'test@example.com',
        party_size: 2,
        start_time: '2026-06-15T18:00:00.000Z',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('tenant_not_available');
    });

    it('returns slot_no_longer_available when the requested start_time has no matching slot', async () => {
      // Garbage start_time that doesn't match any slot the generator produces.
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'test@example.com',
        party_size: 2,
        start_time: '2026-06-15T03:14:00.000Z',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('slot_no_longer_available');
    });

    it('returns slot_no_longer_available when capacity is fully saturated', async () => {
      const slot = await firstSlot();
      // max_concurrent_bookings=8 on the diner rule. Saturate by
      // creating 8 fresh time-slot bookings on the same window. (Seed
      // only ships 2 villa bookings, so re-targeting alone wouldn't
      // be enough.)
      for (let i = 0; i < 8; i++) {
        await createPublicBooking({
          tenantSlug: VILLA_SLUG,
          customer_name: `Saturator ${i}`,
          customer_email: `sat${i}@example.com`,
          party_size: 1,
          start_time: slot.start_time,
        });
      }
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'test@example.com',
        party_size: 2,
        start_time: slot.start_time,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('slot_no_longer_available');
    });

    it('returns slot_no_longer_available for a closed-exception date', async () => {
      // 2026-12-25 is closed in seed; generator returns []; create
      // can't find a matching slot.
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'test@example.com',
        party_size: 2,
        start_time: '2026-12-25T18:00:00.000Z',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('slot_no_longer_available');
    });

    it('rejects a phone number that fails the validation phone regex', async () => {
      const slot = await firstSlot();
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Test Klant',
        customer_email: 'test@example.com',
        party_size: 2,
        start_time: slot.start_time,
        // Letters aren't allowed by the booking insert phone regex.
        customer_phone: 'abc',
      });
      expect(result.success).toBe(false);
      // The phone regex check happens in `bookingsRepo.create`, so
      // the action surfaces it as `unknown_error`. Either is fine —
      // we just want to be sure we don't crash + don't say success.
      expect(['unknown_error', 'validation_failed']).toContain(result.error);
    });
  });

  describe('fetchPublicSlots', () => {
    it('returns slots for a valid tenant+date', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: '2026-06-15',
        partySize: 2,
      });
      expect(slots.length).toBeGreaterThan(0);
    });

    it('returns [] for a malformed date', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: 'whatever',
        partySize: 2,
      });
      expect(slots).toEqual([]);
    });

    it('returns [] for a tenant without bookings_enabled', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: RESTAURANT_SLUG,
        date: '2026-06-15',
        partySize: 2,
      });
      expect(slots).toEqual([]);
    });

    it('returns [] for an unknown slug', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: 'no-such-tenant',
        date: '2026-06-15',
        partySize: 2,
      });
      expect(slots).toEqual([]);
    });
  });

  describe('rule sanity — touches the availability rules repo so the test file is self-contained', () => {
    it('villa tenant exposes 9 active rules via the rules repo', async () => {
      const rules = await availabilityRulesRepo.listActive(VILLA_TENANT_ID);
      expect(rules.length).toBe(9);
    });

    it('villa tenant exposes the seeded Christmas closure', async () => {
      const xmas = await bookingExceptionsRepo.findByDate(VILLA_TENANT_ID, '2026-12-25');
      expect(xmas?.is_closed).toBe(true);
    });
  });
});
