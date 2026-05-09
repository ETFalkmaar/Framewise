import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetStore } from '@/lib/data';
import {
  assertCanEditPages,
  assertCanManageTenant,
  canEditPages,
  canManageTenant,
  canViewTenant,
  ForbiddenError,
  isSuperAdmin,
} from '@/lib/auth';

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';
const RESTAURANT_OWNER_ID = 'a0000000-0000-0000-0000-000000000003';
const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';
const STRANGER_ID = 'a0000000-0000-0000-0000-000000000099';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('canEditPages', () => {
  it('allows the villa owner', async () => {
    expect(await canEditPages(VILLA_OWNER_ID, VILLA_ID)).toBe(true);
  });

  it('allows the super-admin (cross-tenant)', async () => {
    expect(await canEditPages(SUPER_ADMIN_ID, VILLA_ID)).toBe(true);
    expect(await canEditPages(SUPER_ADMIN_ID, RESTAURANT_ID)).toBe(true);
  });

  it('denies a user without membership', async () => {
    expect(await canEditPages(STRANGER_ID, VILLA_ID)).toBe(false);
  });

  it('denies a villa owner on a foreign tenant', async () => {
    expect(await canEditPages(VILLA_OWNER_ID, RESTAURANT_ID)).toBe(false);
  });
});

describe('canManageTenant', () => {
  it('allows the owner', async () => {
    expect(await canManageTenant(VILLA_OWNER_ID, VILLA_ID)).toBe(true);
    expect(await canManageTenant(RESTAURANT_OWNER_ID, RESTAURANT_ID)).toBe(true);
  });

  it('denies cross-tenant', async () => {
    expect(await canManageTenant(VILLA_OWNER_ID, RESTAURANT_ID)).toBe(false);
  });

  it('allows the super-admin everywhere', async () => {
    expect(await canManageTenant(SUPER_ADMIN_ID, VILLA_ID)).toBe(true);
  });
});

describe('canViewTenant', () => {
  it('allows any membership', async () => {
    expect(await canViewTenant(VILLA_OWNER_ID, VILLA_ID)).toBe(true);
  });

  it('denies non-members', async () => {
    expect(await canViewTenant(STRANGER_ID, VILLA_ID)).toBe(false);
  });
});

describe('isSuperAdmin', () => {
  it('returns true only for the super-admin user', async () => {
    expect(await isSuperAdmin(SUPER_ADMIN_ID)).toBe(true);
    expect(await isSuperAdmin(VILLA_OWNER_ID)).toBe(false);
    expect(await isSuperAdmin(STRANGER_ID)).toBe(false);
  });
});

describe('assert helpers', () => {
  it('assertCanEditPages throws ForbiddenError for non-members', async () => {
    await expect(assertCanEditPages(STRANGER_ID, VILLA_ID)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('assertCanManageTenant throws ForbiddenError on cross-tenant', async () => {
    await expect(assertCanManageTenant(VILLA_OWNER_ID, RESTAURANT_ID)).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it('assertCanEditPages does not throw for the owner', async () => {
    await expect(assertCanEditPages(VILLA_OWNER_ID, VILLA_ID)).resolves.toBeUndefined();
  });
});
