import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { resetStore, tenantsRepo } from '@/lib/data';

import { canAddRemoveBlocks, canEditBlocks } from '../block-editor';

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';
const RESTAURANT_OWNER_ID = 'a0000000-0000-0000-0000-000000000003';
const STRANGER_ID = 'a0000000-0000-0000-0000-000000000099';
const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

async function villa() {
  const t = await tenantsRepo.findById(VILLA_ID);
  if (!t) throw new Error('villa missing');
  return t;
}

async function restaurant() {
  const t = await tenantsRepo.findById(RESTAURANT_ID);
  if (!t) throw new Error('restaurant missing');
  return t;
}

describe('canEditBlocks', () => {
  it('allows the villa owner on the enterprise plan', async () => {
    expect(await canEditBlocks(VILLA_OWNER_ID, await villa(), 'enterprise')).toBe(true);
  });

  it('allows the restaurant owner on the pro plan', async () => {
    expect(await canEditBlocks(RESTAURANT_OWNER_ID, await restaurant(), 'pro')).toBe(true);
  });

  it('blocks the same owner when the plan is basic', async () => {
    expect(await canEditBlocks(VILLA_OWNER_ID, await villa(), 'basic')).toBe(false);
  });

  it('blocks the same owner when no plan is found', async () => {
    expect(await canEditBlocks(VILLA_OWNER_ID, await villa(), null)).toBe(false);
  });

  it('blocks a stranger even on enterprise', async () => {
    expect(await canEditBlocks(STRANGER_ID, await villa(), 'enterprise')).toBe(false);
  });

  it('blocks the restaurant owner from editing the villa tenant', async () => {
    expect(await canEditBlocks(RESTAURANT_OWNER_ID, await villa(), 'enterprise')).toBe(false);
  });

  it('lets the super-admin edit any plan tier (including basic)', async () => {
    expect(await canEditBlocks(SUPER_ADMIN_ID, await villa(), 'basic')).toBe(true);
    expect(await canEditBlocks(SUPER_ADMIN_ID, await villa(), null)).toBe(true);
  });
});

describe('canAddRemoveBlocks', () => {
  it('allows the villa owner on enterprise', async () => {
    expect(await canAddRemoveBlocks(VILLA_OWNER_ID, await villa(), 'enterprise')).toBe(true);
  });

  it('blocks the pro-plan restaurant owner from add/remove', async () => {
    expect(await canAddRemoveBlocks(RESTAURANT_OWNER_ID, await restaurant(), 'pro')).toBe(false);
  });

  it('blocks the basic plan', async () => {
    expect(await canAddRemoveBlocks(VILLA_OWNER_ID, await villa(), 'basic')).toBe(false);
  });

  it('blocks a stranger even on enterprise', async () => {
    expect(await canAddRemoveBlocks(STRANGER_ID, await villa(), 'enterprise')).toBe(false);
  });

  it('lets the super-admin add/remove on any plan', async () => {
    expect(await canAddRemoveBlocks(SUPER_ADMIN_ID, await restaurant(), 'pro')).toBe(true);
    expect(await canAddRemoveBlocks(SUPER_ADMIN_ID, await villa(), 'basic')).toBe(true);
  });

  it('blocks edit-but-not-add scenario: pro owner gets edit, not add', async () => {
    const tenant = await restaurant();
    expect(await canEditBlocks(RESTAURANT_OWNER_ID, tenant, 'pro')).toBe(true);
    expect(await canAddRemoveBlocks(RESTAURANT_OWNER_ID, tenant, 'pro')).toBe(false);
  });
});
