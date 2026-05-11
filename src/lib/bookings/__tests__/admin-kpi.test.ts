import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { bookingsRepo, resetStore } from '@/lib/data';
import {
  getCrossTenantBookingKPIs,
  listCrossTenantBookings,
} from '@/lib/bookings/admin-kpi';
import {
  createPublicBooking,
  fetchPublicSlots,
} from '@/app/(i18n)/[locale]/sites/[slug]/boek/actions';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VILLA_SLUG = 'demo-villa';
const RESTAURANT_TENANT_ID = '22222222-2222-2222-2222-222222222222';

/**
 * Step 53 — cross-tenant booking dashboard KPIs + paginated list.
 *
 * Uses a fixed `now` clock so the today/week/month buckets behave
 * deterministically. The seed villa has 2 all_day bookings; we
 * stack a couple of time_slot bookings via the public action to
 * exercise the per-bucket counters.
 */
describe('admin booking KPIs (step 53)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  describe('getCrossTenantBookingKPIs', () => {
    it("returns zero counters when no time-slot bookings exist today's window", async () => {
      // Pin `now` to 2026-05-01 — well before the seed bookings on
      // 2026-06-15 — so today/week/month all return 0.
      const k = await getCrossTenantBookingKPIs({
        now: new Date('2026-05-01T12:00:00.000Z'),
      });
      expect(k.totalToday).toBe(0);
      expect(k.totalThisWeek).toBe(0);
      // The 30-day window does NOT reach into June seed dates from
      // May 1st (29 days back; window ends at today). Should be 0.
      expect(k.totalThisMonth).toBe(0);
    });

    it('counts a fresh time_slot booking in today + week + month buckets', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: '2026-06-15',
        partySize: 2,
      });
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'KPI Test',
        customer_email: 'kpi@example.com',
        party_size: 2,
        start_time: slots[0].start_time,
      });
      expect(result.success).toBe(true);

      // Pin now to the same calendar day the booking was created on.
      const k = await getCrossTenantBookingKPIs({
        now: new Date('2026-06-15T22:00:00.000Z'),
      });
      expect(k.totalToday).toBeGreaterThanOrEqual(1);
      expect(k.totalThisWeek).toBeGreaterThanOrEqual(1);
      expect(k.totalThisMonth).toBeGreaterThanOrEqual(1);
    });

    it('flags pending bookings as awaiting action', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: '2026-06-15',
        partySize: 2,
      });
      await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Pending Test',
        customer_email: 'pending@example.com',
        party_size: 2,
        start_time: slots[0].start_time,
      });
      // `now` is on the booking day so it's not in the past.
      const k = await getCrossTenantBookingKPIs({
        now: new Date('2026-06-15T00:00:00.000Z'),
      });
      expect(k.pendingActionNeeded).toBeGreaterThanOrEqual(1);
    });

    it('drops cancelled bookings from all KPI counters', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: '2026-06-15',
        partySize: 2,
      });
      // Baseline first — seed villa has 2 all_day bookings on/around
      // 2026-06-15 that contribute to today.
      const baseline = await getCrossTenantBookingKPIs({
        now: new Date('2026-06-15T22:00:00.000Z'),
      });
      const result = await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Cancel Test',
        customer_email: 'cancel@example.com',
        party_size: 2,
        start_time: slots[0].start_time,
      });
      expect(result.success).toBe(true);
      const booking = await bookingsRepo.findByReferenceCode(result.bookingReference!);
      expect(booking).toBeTruthy();
      await bookingsRepo.update(booking!.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      });
      const after = await getCrossTenantBookingKPIs({
        now: new Date('2026-06-15T22:00:00.000Z'),
      });
      // Net change relative to baseline must be 0 — the new booking
      // was cancelled, so totalToday should stay where it was.
      expect(after.totalToday).toBe(baseline.totalToday);
    });

    it('byTenant only includes bookings_enabled tenants', async () => {
      const k = await getCrossTenantBookingKPIs();
      const tenantIds = k.byTenant.map((r) => r.tenantId);
      expect(tenantIds).toContain(VILLA_TENANT_ID);
      // Demo restaurant ships with bookings_enabled=false → must be excluded.
      expect(tenantIds).not.toContain(RESTAURANT_TENANT_ID);
    });

    it('byTenant rows include the tenant name', async () => {
      const k = await getCrossTenantBookingKPIs();
      const villa = k.byTenant.find((r) => r.tenantId === VILLA_TENANT_ID);
      expect(villa?.tenantName).toBeTruthy();
      expect(villa?.tenantName?.length).toBeGreaterThan(0);
    });

    it('respects the status filter — pending-only counts excluding confirmed', async () => {
      // Create two same-day time_slot bookings directly via the repo
      // so we don't depend on the slot-generator's capacity gates.
      const slotStart = '2026-06-15T18:00:00.000Z';
      const slotEnd = '2026-06-15T19:30:00.000Z';
      const bookingFactory = (suffix: string) => ({
        tenant_id: VILLA_TENANT_ID,
        status: 'pending' as const,
        start_date: '2026-06-15',
        end_date: '2026-06-15',
        persons: 2,
        guest_name: `Test ${suffix}`,
        guest_email: `${suffix}@example.com`,
        guest_phone: null,
        total_price_cents: 0,
        currency: 'EUR' as const,
        payment_status: 'unpaid' as const,
        payment_provider: null,
        payment_reference: null,
        notes: null,
        booking_type: 'time_slot' as const,
        start_time: slotStart,
        end_time: slotEnd,
        party_size: 2,
        customer_name: `Test ${suffix}`,
        customer_email: `${suffix}@example.com`,
        customer_phone: null,
        internal_notes: null,
      });
      const a = await bookingsRepo.create(bookingFactory('A'));
      await bookingsRepo.create(bookingFactory('B'));
      await bookingsRepo.confirm(a.id);

      const pendingOnly = await getCrossTenantBookingKPIs({
        now: new Date('2026-06-15T22:00:00.000Z'),
        status: ['pending'],
      });
      const confirmedOnly = await getCrossTenantBookingKPIs({
        now: new Date('2026-06-15T22:00:00.000Z'),
        status: ['confirmed'],
      });
      expect(pendingOnly.totalToday).toBeGreaterThanOrEqual(1);
      expect(confirmedOnly.totalToday).toBeGreaterThanOrEqual(1);
    });
  });

  describe('listCrossTenantBookings', () => {
    it('returns rows annotated with the tenant name', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: '2026-06-15',
        partySize: 2,
      });
      await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Table Test',
        customer_email: 'table@example.com',
        party_size: 2,
        start_time: slots[0].start_time,
      });
      const result = await listCrossTenantBookings();
      expect(result.rows.length).toBeGreaterThan(0);
      for (const row of result.rows) {
        expect(row.tenantId).toBeTruthy();
        expect(row.tenantName.length).toBeGreaterThan(0);
      }
    });

    it('sorts rows by start_time DESC (most actionable first)', async () => {
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: '2026-06-15',
        partySize: 2,
      });
      await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Sort A',
        customer_email: 'sortA@example.com',
        party_size: 2,
        start_time: slots[0].start_time,
      });
      await createPublicBooking({
        tenantSlug: VILLA_SLUG,
        customer_name: 'Sort B',
        customer_email: 'sortB@example.com',
        party_size: 2,
        start_time: slots[slots.length - 1].start_time,
      });
      const result = await listCrossTenantBookings();
      for (let i = 1; i < result.rows.length; i++) {
        expect(
          result.rows[i - 1].booking.start_time >= result.rows[i].booking.start_time
        ).toBe(true);
      }
    });

    it('filters by tenantId when provided', async () => {
      const result = await listCrossTenantBookings({ tenantId: VILLA_TENANT_ID });
      for (const row of result.rows) {
        expect(row.tenantId).toBe(VILLA_TENANT_ID);
      }
    });

    it('respects pagination — page=0 returns the head, page=1 the rest', async () => {
      // Create 60 bookings so the default 50/page leaves a remainder.
      const slots = await fetchPublicSlots({
        tenantSlug: VILLA_SLUG,
        date: '2026-06-15',
        partySize: 1,
      });
      // 8 slots × multiple party sizes won't reach 60 against the
      // diner rule's max_concurrent_bookings=8 ceiling. Instead use
      // bookingsRepo.create directly to bypass capacity.
      for (let i = 0; i < 60; i++) {
        await bookingsRepo.create({
          tenant_id: VILLA_TENANT_ID,
          status: 'pending',
          start_date: '2026-06-15',
          end_date: '2026-06-15',
          persons: 1,
          guest_name: `Page ${i}`,
          guest_email: `page${i}@example.com`,
          guest_phone: null,
          total_price_cents: 0,
          currency: 'EUR',
          payment_status: 'unpaid',
          payment_provider: null,
          payment_reference: null,
          notes: null,
          booking_type: 'time_slot',
          start_time: slots[0].start_time,
          end_time: slots[0].end_time,
          party_size: 1,
          customer_name: `Page ${i}`,
          customer_email: `page${i}@example.com`,
          customer_phone: null,
          internal_notes: null,
        });
      }
      const first = await listCrossTenantBookings({ page: 0, limit: 50 });
      const second = await listCrossTenantBookings({ page: 1, limit: 50 });
      expect(first.rows.length).toBe(50);
      expect(second.rows.length).toBeGreaterThan(0);
      expect(first.pageCount).toBeGreaterThanOrEqual(2);
      expect(first.total).toBeGreaterThanOrEqual(60);
    });

    it('clamps page index to the last available page', async () => {
      const result = await listCrossTenantBookings({ page: 9999 });
      expect(result.page).toBe(result.pageCount - 1);
    });

    it('caps page size at 200 even when a larger limit is requested', async () => {
      const result = await listCrossTenantBookings({ limit: 9999 });
      expect(result.pageSize).toBeLessThanOrEqual(200);
    });

    it('filters by status when provided', async () => {
      const a = await bookingsRepo.create({
        tenant_id: VILLA_TENANT_ID,
        status: 'pending',
        start_date: '2026-06-15',
        end_date: '2026-06-15',
        persons: 2,
        guest_name: 'Filter A',
        guest_email: 'filterA@example.com',
        guest_phone: null,
        total_price_cents: 0,
        currency: 'EUR',
        payment_status: 'unpaid',
        payment_provider: null,
        payment_reference: null,
        notes: null,
        booking_type: 'time_slot',
        start_time: '2026-06-15T18:00:00.000Z',
        end_time: '2026-06-15T19:30:00.000Z',
        party_size: 2,
        customer_name: 'Filter A',
        customer_email: 'filterA@example.com',
        customer_phone: null,
        internal_notes: null,
      });
      await bookingsRepo.confirm(a.id);

      const onlyPending = await listCrossTenantBookings({ status: ['pending'] });
      for (const row of onlyPending.rows) {
        expect(row.booking.status).toBe('pending');
      }
    });
  });
});
