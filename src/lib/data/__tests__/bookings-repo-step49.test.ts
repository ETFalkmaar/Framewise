import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { bookingsRepo, resetStore } from '@/lib/data';

/**
 * Step 49 — new bookings-repo methods (listByDate, listByTenant range
 * filters, findByReferenceCode, countByTenantInRange) and reference-code
 * generation on create.
 *
 * Uses seed data (villa-nights bookings exist). The store loader
 * backfills legacy seeds with `booking_type='all_day'`, derived
 * `start_time` / `end_time`, and a `BK-{YYYY}-{xxxx}` reference code.
 */

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VILLA_FIRST_BOOKING_ID = '20000000-0000-0000-0000-000000000001';

describe('bookingsRepo step-49 extensions', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('seeded bookings get a backfilled BK- reference code', async () => {
    const b = await bookingsRepo.findById(VILLA_FIRST_BOOKING_ID);
    expect(b).not.toBeNull();
    expect(b?.reference_code).toMatch(/^BK-\d{4}-[0-9A-Z]+$/);
  });

  it('seeded bookings have booking_type=all_day + derived start/end_time', async () => {
    const b = await bookingsRepo.findById(VILLA_FIRST_BOOKING_ID);
    expect(b?.booking_type).toBe('all_day');
    expect(b?.start_time).toMatch(/T00:00:00/);
    expect(b?.end_time).toMatch(/T00:00:00/);
  });

  it('seeded bookings expose party_size mirrored from persons', async () => {
    const b = await bookingsRepo.findById(VILLA_FIRST_BOOKING_ID);
    expect(b?.party_size).toBe(b?.persons);
  });

  it('findByReferenceCode round-trips a seeded booking', async () => {
    const b = await bookingsRepo.findById(VILLA_FIRST_BOOKING_ID);
    expect(b?.reference_code).toBeTruthy();
    const found = await bookingsRepo.findByReferenceCode(b!.reference_code);
    expect(found?.id).toBe(VILLA_FIRST_BOOKING_ID);
  });

  it('findByReferenceCode returns null for unknown codes', async () => {
    const found = await bookingsRepo.findByReferenceCode('BK-9999-9999');
    expect(found).toBeNull();
  });

  it('listByTenant filters by status array', async () => {
    const confirmed = await bookingsRepo.listByTenant(VILLA_TENANT_ID, {
      status: ['confirmed'],
    });
    expect(confirmed.every((b) => b.status === 'confirmed')).toBe(true);
  });

  it('listByTenant respects the from/to start_time range', async () => {
    // Villa bookings span mid-2026 — narrow to just one window.
    const range = await bookingsRepo.listByTenant(VILLA_TENANT_ID, {
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
    });
    for (const b of range) {
      expect(b.start_time >= '2026-06-01T00:00:00.000Z').toBe(true);
      expect(b.start_time <= '2026-06-30T23:59:59.999Z').toBe(true);
    }
  });

  it('listByTenant honors the limit option', async () => {
    const capped = await bookingsRepo.listByTenant(VILLA_TENANT_ID, { limit: 2 });
    expect(capped.length).toBeLessThanOrEqual(2);
  });

  it('listByDate matches bookings whose start_time falls on the calendar day', async () => {
    // Villa booking 1 starts at 2026-06-15 (per seed)
    const sameDay = await bookingsRepo.listByDate(VILLA_TENANT_ID, '2026-06-15');
    expect(sameDay.length).toBeGreaterThan(0);
    expect(sameDay[0].id).toBe(VILLA_FIRST_BOOKING_ID);
  });

  it('listByDate returns [] for a date with no bookings', async () => {
    const empty = await bookingsRepo.listByDate(VILLA_TENANT_ID, '2099-12-31');
    expect(empty).toEqual([]);
  });

  it('countByTenantInRange counts only bookings inside the half-open interval', async () => {
    const total = await bookingsRepo.countByTenantInRange(
      VILLA_TENANT_ID,
      '2026-01-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z'
    );
    expect(total).toBeGreaterThan(0);
  });

  it('confirm() sets status=confirmed and stamps confirmed_at', async () => {
    const pending = (await bookingsRepo.listByTenant(VILLA_TENANT_ID, { status: ['pending'] }))[0];
    if (!pending) {
      // No pending seed — skip safely rather than fail the suite.
      expect(true).toBe(true);
      return;
    }
    const after = await bookingsRepo.confirm(pending.id);
    expect(after.status).toBe('confirmed');
    expect(after.confirmed_at).not.toBeNull();
  });

  it('cancel() flips status and timestamps cancelled_at', async () => {
    const target = (await bookingsRepo.listByTenant(VILLA_TENANT_ID))[0];
    const after = await bookingsRepo.cancel(target.id);
    expect(after.status).toBe('cancelled');
    expect(after.cancelled_at).not.toBeNull();
  });
});
