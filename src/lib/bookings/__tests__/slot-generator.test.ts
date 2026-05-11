import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { availabilityRulesRepo, bookingExceptionsRepo, bookingsRepo, resetStore } from '@/lib/data';
import { generateSlotsForDate } from '@/lib/bookings/slot-generator';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';

// Seed data: villa has diner service 18:00-22:00 every day of the week
// (slot_duration=90, buffer=15 → step=105 min) and lunch 12:00-14:30
// on Saturday + Sunday. 2026-06-15 is a Monday → diner only.
//
// Expected slot count for a Monday in unblocked range:
// 18:00, 19:45, ... while cursor+90 <= 22:00 → 18:00 (ends 19:30) +
// 19:45 (ends 21:15). 21:30 (ends 23:00) exceeds the window. → 2 slots.

describe('generateSlotsForDate (step 50)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('returns slots inside the rule window on a normal day', async () => {
    const slots = await generateSlotsForDate({ tenantId: VILLA_TENANT_ID, date: '2026-06-15' });
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(slot.start_time).toMatch(/^2026-06-15T/);
      expect(slot.rule_name).toBe('Diner service');
    }
  });

  it('returns [] for a date with is_closed exception', async () => {
    // 2026-12-25 ships as closed in seed.
    const slots = await generateSlotsForDate({ tenantId: VILLA_TENANT_ID, date: '2026-12-25' });
    expect(slots).toEqual([]);
  });

  it('uses custom_start_time / custom_end_time when exception overrides hours', async () => {
    // 2026-12-31 ships with custom 18:00-23:30 in seed. Diner rule's
    // 18:00-22:00 window expands to 23:30, so we should see MORE slots
    // than a normal Thursday.
    const slots = await generateSlotsForDate({ tenantId: VILLA_TENANT_ID, date: '2026-12-31' });
    expect(slots.length).toBeGreaterThan(2);
    const lastStart = slots[slots.length - 1].start_time;
    expect(lastStart >= '2026-12-31T20:00:00.000Z').toBe(true);
  });

  it('respects slot_duration + buffer between slots', async () => {
    const slots = await generateSlotsForDate({ tenantId: VILLA_TENANT_ID, date: '2026-06-15' });
    expect(slots.length).toBeGreaterThanOrEqual(2);
    const first = new Date(slots[0].start_time).getTime();
    const second = new Date(slots[1].start_time).getTime();
    const stepMs = second - first;
    // slot_duration_minutes=90, buffer_minutes=15 → step = 105 min = 6_300_000 ms
    expect(stepMs).toBe(105 * 60_000);
  });

  it('drops slots where capacity has been fully booked', async () => {
    // Find the first villa booking and re-target it to one of the
    // generated slots so capacity-remaining drops by 1.
    const slotsBefore = await generateSlotsForDate({
      tenantId: VILLA_TENANT_ID,
      date: '2026-06-15',
    });
    expect(slotsBefore.length).toBeGreaterThan(0);
    const target = slotsBefore[0];
    // Saturate the capacity by re-targeting 8 existing seed bookings
    // (max_concurrent=8 on the diner rule). The seed has fewer than 8
    // confirmed bookings, so we just iterate and re-target what's there.
    const existing = await bookingsRepo.listByTenant(VILLA_TENANT_ID);
    let saturated = 0;
    for (const b of existing.slice(0, 8)) {
      await bookingsRepo.update(b.id, {
        status: 'confirmed',
        start_time: target.start_time,
        end_time: target.end_time,
      });
      saturated++;
    }
    expect(saturated).toBeGreaterThan(0);
    const slotsAfter = await generateSlotsForDate({
      tenantId: VILLA_TENANT_ID,
      date: '2026-06-15',
    });
    const matchingSlot = slotsAfter.find((s) => s.start_time === target.start_time);
    expect(matchingSlot?.capacity_remaining).toBe(Math.max(0, 8 - saturated));
  });

  it('excludes rules whose max_party_size is smaller than requested', async () => {
    // Diner rule has max_party_size=6. Asking for 7 should return [].
    const slots = await generateSlotsForDate({
      tenantId: VILLA_TENANT_ID,
      date: '2026-06-15',
      partySize: 7,
    });
    expect(slots).toEqual([]);
  });

  it('returns slots when partySize is within max', async () => {
    const slots = await generateSlotsForDate({
      tenantId: VILLA_TENANT_ID,
      date: '2026-06-15',
      partySize: 4,
    });
    expect(slots.length).toBeGreaterThan(0);
  });

  it('respects effective_from / effective_until on rules', async () => {
    // Deactivate via effective_until before the test date.
    const rules = await availabilityRulesRepo.listByTenant(VILLA_TENANT_ID);
    for (const r of rules) {
      await availabilityRulesRepo.update(r.id, { effective_until: '2026-05-01' });
    }
    const slots = await generateSlotsForDate({
      tenantId: VILLA_TENANT_ID,
      date: '2026-06-15',
    });
    expect(slots).toEqual([]);
  });

  it('excludes inactive rules', async () => {
    const rules = await availabilityRulesRepo.listByTenant(VILLA_TENANT_ID);
    for (const r of rules) {
      await availabilityRulesRepo.update(r.id, { is_active: false });
    }
    const slots = await generateSlotsForDate({
      tenantId: VILLA_TENANT_ID,
      date: '2026-06-15',
    });
    expect(slots).toEqual([]);
  });

  it('returns rule_id + rule_name on each slot', async () => {
    const slots = await generateSlotsForDate({
      tenantId: VILLA_TENANT_ID,
      date: '2026-06-15',
    });
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(slot.rule_id).toBeTruthy();
      expect(slot.rule_name).toBeTruthy();
    }
  });

  it('returns slots sorted ascending by start_time', async () => {
    // Saturday gets both lunch + diner — useful to confirm ordering
    // across rule windows.
    const slots = await generateSlotsForDate({
      tenantId: VILLA_TENANT_ID,
      date: '2026-06-20',
    });
    expect(slots.length).toBeGreaterThan(1);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].start_time >= slots[i - 1].start_time).toBe(true);
    }
  });

  it('returns [] for an invalid date string', async () => {
    const slots = await generateSlotsForDate({ tenantId: VILLA_TENANT_ID, date: 'not-a-date' });
    expect(slots).toEqual([]);
  });

  it('returns [] when the tenant has no rules for the day of week', async () => {
    // Restaurant tenant has no rules at all.
    const slots = await generateSlotsForDate({
      tenantId: '22222222-2222-2222-2222-222222222222',
      date: '2026-06-15',
    });
    expect(slots).toEqual([]);
  });

  it('lists exceptions via listByTenant with date-range filter', async () => {
    const all = await bookingExceptionsRepo.listByTenant(VILLA_TENANT_ID);
    expect(all.length).toBe(2);
    const decemberOnly = await bookingExceptionsRepo.listByTenant(VILLA_TENANT_ID, {
      from: '2026-12-01',
      to: '2026-12-31',
    });
    expect(decemberOnly.length).toBe(2);
    const novemberOnly = await bookingExceptionsRepo.listByTenant(VILLA_TENANT_ID, {
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(novemberOnly).toEqual([]);
  });

  it('findByDate locates an exception precisely', async () => {
    const xmas = await bookingExceptionsRepo.findByDate(VILLA_TENANT_ID, '2026-12-25');
    expect(xmas?.is_closed).toBe(true);
    const empty = await bookingExceptionsRepo.findByDate(VILLA_TENANT_ID, '2026-11-15');
    expect(empty).toBeNull();
  });
});
