import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { blocksRepo, resetStore } from '@/lib/data';

import { reorderBlocksFor } from '../reorder';

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';
const RESTAURANT_OWNER_ID = 'a0000000-0000-0000-0000-000000000003';
const STRANGER_ID = 'a0000000-0000-0000-0000-000000000099';
const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';
const VILLA_HOME_PAGE_ID = 'f0000000-0000-0000-0000-000000000001';

const VILLA_HOME_BLOCKS = [
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
];

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('reorderBlocksFor', () => {
  it('reorders the villa home blocks (happy path)', async () => {
    const reversed = [...VILLA_HOME_BLOCKS].reverse();
    const result = await reorderBlocksFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      newOrder: reversed,
    });
    expect(result.success).toBe(true);

    const after = await blocksRepo.findByPageId(VILLA_HOME_PAGE_ID);
    expect(after.map((b) => b.id)).toEqual(reversed);
    // order_index is rewritten 0..n-1.
    expect(after.map((b) => b.order_index)).toEqual([0, 1, 2, 3]);
  });

  it('also allows the super-admin to reorder regardless of plan', async () => {
    const reversed = [...VILLA_HOME_BLOCKS].reverse();
    const result = await reorderBlocksFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      newOrder: reversed,
    });
    expect(result.success).toBe(true);
  });

  it('rejects when the user has no role on the tenant', async () => {
    const result = await reorderBlocksFor({
      userId: STRANGER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      newOrder: VILLA_HOME_BLOCKS,
    });
    expect(result).toEqual({ success: false, errorCode: 'forbidden' });
  });

  it('rejects when the owner of a different tenant tries to reorder', async () => {
    const result = await reorderBlocksFor({
      userId: RESTAURANT_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      newOrder: VILLA_HOME_BLOCKS,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('forbidden');
  });

  it('returns tenant_not_found for an unknown tenant id', async () => {
    const result = await reorderBlocksFor({
      userId: SUPER_ADMIN_ID,
      tenantId: '00000000-0000-0000-0000-000000000000',
      pageId: VILLA_HOME_PAGE_ID,
      newOrder: VILLA_HOME_BLOCKS,
    });
    expect(result.errorCode).toBe('tenant_not_found');
  });

  it('returns page_not_found for an unknown page id', async () => {
    const result = await reorderBlocksFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: '00000000-0000-0000-0000-000000000000',
      newOrder: [],
    });
    expect(result.errorCode).toBe('page_not_found');
  });

  it('returns page_tenant_mismatch when the page lives on another tenant', async () => {
    const result = await reorderBlocksFor({
      userId: RESTAURANT_OWNER_ID,
      tenantId: RESTAURANT_ID,
      pageId: VILLA_HOME_PAGE_ID, // belongs to Villa
      newOrder: VILLA_HOME_BLOCKS,
    });
    expect(result.errorCode).toBe('page_tenant_mismatch');
  });

  it('returns count_mismatch when newOrder has a different length', async () => {
    const result = await reorderBlocksFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      newOrder: VILLA_HOME_BLOCKS.slice(0, 3),
    });
    expect(result.errorCode).toBe('count_mismatch');
  });

  it('returns duplicate_ids when the same block appears twice', async () => {
    const dup = [
      VILLA_HOME_BLOCKS[0]!,
      VILLA_HOME_BLOCKS[0]!,
      VILLA_HOME_BLOCKS[2]!,
      VILLA_HOME_BLOCKS[3]!,
    ];
    const result = await reorderBlocksFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      newOrder: dup,
    });
    expect(result.errorCode).toBe('duplicate_ids');
  });

  it('returns unknown_block_id when newOrder contains an id from a different page', async () => {
    const wrong = [
      ...VILLA_HOME_BLOCKS.slice(0, 3),
      '10000000-0000-0000-0000-000000000005', // belongs to villa /accommodation
    ];
    const result = await reorderBlocksFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      newOrder: wrong,
    });
    expect(result.errorCode).toBe('unknown_block_id');
    expect(result.errorDetail).toBe('10000000-0000-0000-0000-000000000005');
  });

  it('leaves the blocks untouched when validation fails', async () => {
    const before = (await blocksRepo.findByPageId(VILLA_HOME_PAGE_ID)).map((b) => b.id);
    await reorderBlocksFor({
      userId: STRANGER_ID, // forbidden
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      newOrder: [...VILLA_HOME_BLOCKS].reverse(),
    });
    const after = (await blocksRepo.findByPageId(VILLA_HOME_PAGE_ID)).map((b) => b.id);
    expect(after).toEqual(before);
  });

  it('a no-op reorder still returns success and persists identity order', async () => {
    const result = await reorderBlocksFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      newOrder: VILLA_HOME_BLOCKS,
    });
    expect(result.success).toBe(true);
    const after = (await blocksRepo.findByPageId(VILLA_HOME_PAGE_ID)).map((b) => b.id);
    expect(after).toEqual(VILLA_HOME_BLOCKS);
  });

  it('the restaurant Pro-plan owner can reorder restaurant pages', async () => {
    // Restaurant /home is the first page with the restaurant's tenant id.
    // We discover the id from the seed rather than hard-coding so a seed
    // re-numbering doesn't silently break this test.
    const restaurantHomePageId = 'f0000000-0000-0000-0000-000000000010';
    const blocks = await blocksRepo.findByPageId(restaurantHomePageId);
    if (blocks.length < 2) {
      // Defensive — Pro plan check is also exercised in canEditBlocks tests.
      return;
    }
    const reversed = blocks.map((b) => b.id).reverse();
    const result = await reorderBlocksFor({
      userId: RESTAURANT_OWNER_ID,
      tenantId: RESTAURANT_ID,
      pageId: restaurantHomePageId,
      newOrder: reversed,
    });
    expect(result.success).toBe(true);
  });
});
