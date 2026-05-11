import { beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { resetStore } from '@/lib/data';
import { tenantsRepo } from '@/lib/data';
import {
  canApprovePublishRequest,
  canCancelPublishRequest,
  canRequestPublish,
} from '@/lib/permissions/publishing';
import type { Tenant } from '@/types/database';

/**
 * Step 47 — gates for the publish-request workflow. Backed by the
 * real seed data so the `canEditPages` lookup hits the same
 * tenant_users + roles rows we ship.
 *
 * Seed cast:
 *  - Villa Owner is `owner` on the villa tenant (slug `demo-villa`).
 *  - Restaurant Owner is `owner` on the restaurant tenant
 *    (slug `demo-restaurant`).
 *  - `framewise@example.com` is the super-admin (bypasses everything).
 *  - "Stranger" is just a fresh UUID with no membership.
 */

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';
const RESTAURANT_OWNER_ID = 'a0000000-0000-0000-0000-000000000003';
const STRANGER_ID = '00000000-0000-0000-0000-000000000999';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_TENANT_ID = '22222222-2222-2222-2222-222222222222';

async function getTenant(id: string): Promise<Tenant> {
  const t = await tenantsRepo.findById(id);
  if (!t) throw new Error(`fixture tenant ${id} not loaded`);
  return t;
}

describe('canRequestPublish (step 47)', () => {
  beforeEach(() => resetStore());

  it('returns true for an owner on a draft (onboarding) tenant with no pending request', async () => {
    const t = await getTenant(RESTAURANT_TENANT_ID);
    // Restaurant tenant ships as `live` in seeds — flip it to onboarding for this test.
    await tenantsRepo.update(t.id, { status: 'paused' });
    const fresh = await getTenant(RESTAURANT_TENANT_ID);
    expect(await canRequestPublish(RESTAURANT_OWNER_ID, fresh)).toBe(true);
  });

  it('returns false when the tenant is already live', async () => {
    const t = await getTenant(VILLA_TENANT_ID); // villa ships as `live`
    expect(t.status).toBe('live');
    expect(await canRequestPublish(VILLA_OWNER_ID, t)).toBe(false);
  });

  it('returns false when there is already a pending request (no double-submit)', async () => {
    const t = await getTenant(RESTAURANT_TENANT_ID);
    await tenantsRepo.update(t.id, { status: 'paused' });
    await tenantsRepo.update(t.id, { publish_request_status: 'pending' });
    const fresh = await getTenant(RESTAURANT_TENANT_ID);
    expect(await canRequestPublish(RESTAURANT_OWNER_ID, fresh)).toBe(false);
  });

  it('returns false for a user with no membership on the tenant', async () => {
    const t = await getTenant(RESTAURANT_TENANT_ID);
    await tenantsRepo.update(t.id, { status: 'paused' });
    const fresh = await getTenant(RESTAURANT_TENANT_ID);
    expect(await canRequestPublish(STRANGER_ID, fresh)).toBe(false);
  });

  it('returns true for super-admin even when the request would otherwise be blocked', async () => {
    const villaLive = await getTenant(VILLA_TENANT_ID); // status === 'live'
    expect(await canRequestPublish(SUPER_ADMIN_ID, villaLive)).toBe(true);
  });
});

describe('canCancelPublishRequest (step 47)', () => {
  beforeEach(() => resetStore());

  it('returns true when there is a pending request and the user is the owner', async () => {
    const t = await getTenant(RESTAURANT_TENANT_ID);
    await tenantsRepo.update(t.id, { status: 'paused' });
    await tenantsRepo.update(t.id, { publish_request_status: 'pending' });
    const fresh = await getTenant(RESTAURANT_TENANT_ID);
    expect(await canCancelPublishRequest(RESTAURANT_OWNER_ID, fresh)).toBe(true);
  });

  it('returns false when there is no pending request', async () => {
    const t = await getTenant(RESTAURANT_TENANT_ID); // publish_request_status === 'none'
    expect(await canCancelPublishRequest(RESTAURANT_OWNER_ID, t)).toBe(false);
  });

  it('returns false for a user without membership', async () => {
    const t = await getTenant(RESTAURANT_TENANT_ID);
    await tenantsRepo.update(t.id, { publish_request_status: 'pending' });
    const fresh = await getTenant(RESTAURANT_TENANT_ID);
    expect(await canCancelPublishRequest(STRANGER_ID, fresh)).toBe(false);
  });
});

describe('canApprovePublishRequest (step 47)', () => {
  it('returns true for super-admin', () => {
    expect(canApprovePublishRequest(SUPER_ADMIN_ID)).toBe(true);
  });

  it('returns false for a regular tenant owner', () => {
    expect(canApprovePublishRequest(VILLA_OWNER_ID)).toBe(false);
  });

  it('returns false for an unknown user id', () => {
    expect(canApprovePublishRequest(STRANGER_ID)).toBe(false);
  });
});

describe('publishing gates — cross-tenant + super-admin (step 47)', () => {
  beforeEach(() => resetStore());

  it('canRequestPublish rejects an owner from a different tenant', async () => {
    // Villa owner tries to request publish on the RESTAURANT tenant —
    // their canEditPages check fails because membership is per-tenant.
    const restaurant = await getTenant(RESTAURANT_TENANT_ID);
    await tenantsRepo.update(restaurant.id, { status: 'paused' });
    const fresh = await getTenant(RESTAURANT_TENANT_ID);
    expect(await canRequestPublish(VILLA_OWNER_ID, fresh)).toBe(false);
  });

  it('canCancelPublishRequest super-admin bypass works even with no pending request', async () => {
    // Defensive: super-admin gate returns true unconditionally. The
    // action layer no-ops the cancel when there's nothing pending,
    // so this bypass is safe.
    const restaurant = await getTenant(RESTAURANT_TENANT_ID);
    expect(restaurant.publish_request_status).toBe('none');
    expect(await canCancelPublishRequest(SUPER_ADMIN_ID, restaurant)).toBe(true);
  });

  it('canApprovePublishRequest empty string returns false (no userId match)', () => {
    expect(canApprovePublishRequest('')).toBe(false);
  });
});
