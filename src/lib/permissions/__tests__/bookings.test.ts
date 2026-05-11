import { beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { resetStore, tenantsRepo } from '@/lib/data';
import { canEnableBookings, canManageBookings, canViewBookings } from '@/lib/permissions/bookings';
import type { Tenant } from '@/types/database';

/**
 * Step 49 — booking permission gates. Backed by real seed data:
 *  - Villa tenant ships with `bookings_enabled: true` (Enterprise).
 *  - Restaurant tenant ships with `bookings_enabled: false` (Pro).
 *  - Villa owner is the owner of the villa; Restaurant owner is
 *    the owner of the restaurant.
 *  - Super-admin = framewise@example.com.
 */

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';
const RESTAURANT_OWNER_ID = 'a0000000-0000-0000-0000-000000000003';
const STRANGER_ID = '00000000-0000-0000-0000-000000000999';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_TENANT_ID = '22222222-2222-2222-2222-222222222222';

async function getTenant(id: string): Promise<Tenant> {
  const t = await tenantsRepo.findById(id);
  if (!t) throw new Error(`fixture tenant ${id} missing`);
  return t;
}

describe('canViewBookings (step 49)', () => {
  beforeEach(() => resetStore());

  it('super-admin sees bookings even on a disabled tenant', async () => {
    const restaurant = await getTenant(RESTAURANT_TENANT_ID);
    expect(restaurant.bookings_enabled).toBe(false);
    expect(await canViewBookings(SUPER_ADMIN_ID, restaurant)).toBe(true);
  });

  it('owner of an enabled tenant can view', async () => {
    const villa = await getTenant(VILLA_TENANT_ID);
    expect(villa.bookings_enabled).toBe(true);
    expect(await canViewBookings(VILLA_OWNER_ID, villa)).toBe(true);
  });

  it('owner of a disabled tenant cannot view', async () => {
    const restaurant = await getTenant(RESTAURANT_TENANT_ID);
    expect(await canViewBookings(RESTAURANT_OWNER_ID, restaurant)).toBe(false);
  });

  it('stranger with no membership cannot view', async () => {
    const villa = await getTenant(VILLA_TENANT_ID);
    expect(await canViewBookings(STRANGER_ID, villa)).toBe(false);
  });

  it('cross-tenant owner cannot view a different tenant', async () => {
    const restaurant = await getTenant(RESTAURANT_TENANT_ID);
    await tenantsRepo.update(restaurant.id, { bookings_enabled: true });
    const enabledRestaurant = await getTenant(RESTAURANT_TENANT_ID);
    // Villa owner tries to view restaurant's bookings — fails on
    // `canEditPages` membership check.
    expect(await canViewBookings(VILLA_OWNER_ID, enabledRestaurant)).toBe(false);
  });
});

describe('canManageBookings (step 49)', () => {
  beforeEach(() => resetStore());

  it('super-admin bypasses the disabled-tenant gate', async () => {
    const restaurant = await getTenant(RESTAURANT_TENANT_ID);
    expect(await canManageBookings(SUPER_ADMIN_ID, restaurant)).toBe(true);
  });

  it('owner of enabled tenant can manage', async () => {
    const villa = await getTenant(VILLA_TENANT_ID);
    expect(await canManageBookings(VILLA_OWNER_ID, villa)).toBe(true);
  });

  it('owner of disabled tenant cannot manage', async () => {
    const restaurant = await getTenant(RESTAURANT_TENANT_ID);
    expect(await canManageBookings(RESTAURANT_OWNER_ID, restaurant)).toBe(false);
  });

  it('stranger cannot manage', async () => {
    const villa = await getTenant(VILLA_TENANT_ID);
    expect(await canManageBookings(STRANGER_ID, villa)).toBe(false);
  });
});

describe('canEnableBookings (step 49)', () => {
  it('super-admin only', () => {
    expect(canEnableBookings(SUPER_ADMIN_ID)).toBe(true);
    expect(canEnableBookings(VILLA_OWNER_ID)).toBe(false);
    expect(canEnableBookings(RESTAURANT_OWNER_ID)).toBe(false);
    expect(canEnableBookings(STRANGER_ID)).toBe(false);
    expect(canEnableBookings('')).toBe(false);
  });
});
