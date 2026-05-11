import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { blocksRepo, pagesRepo, resetStore } from '@/lib/data';

/**
 * Step 46 — repository-level checks for the new `version` field
 * on `blocksRepo`. Complements `save-block-conflict.test.ts` which
 * covers the use-case semantics; this file pins down adapter
 * behaviour so a future Supabase swap-in can target the same
 * contract.
 */

const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const VILLA_HOME_TEXT_BLOCK = '10000000-0000-0000-0000-000000000002';

describe('blocksRepo — version tracking (step 46)', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it('seeded blocks start at version 1 (backfill in store.ts)', async () => {
    const block = await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK);
    expect(block).not.toBeNull();
    expect(block?.version).toBe(1);
  });

  it('update() increments version by one', async () => {
    const before = await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK);
    expect(before?.version).toBe(1);

    const after = await blocksRepo.update(VILLA_HOME_TEXT_BLOCK, {
      data: { ...before!.data, _marker: 'tick' },
    });
    expect(after.version).toBe(2);

    const afterFetch = await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK);
    expect(afterFetch?.version).toBe(2);
  });

  it('update() ignores a caller-supplied version field — the adapter owns the counter', async () => {
    // A buggy caller might try to set version=999. The adapter
    // should ignore the patch and increment from the persisted
    // value (1 → 2), so optimistic concurrency stays trustworthy.
    const updated = await blocksRepo.update(VILLA_HOME_TEXT_BLOCK, {
      data: { tweak: 1 },
      version: 999,
    });
    expect(updated.version).toBe(2);
  });

  it('reorder() also increments version on every affected block', async () => {
    // The home page has multiple blocks - reorder all of them.
    const villaHome = (await pagesRepo.listByTenant(VILLA_ID)).find((p) => p.slug === 'home');
    expect(villaHome).toBeDefined();
    const blocks = await blocksRepo.findByPageId(villaHome!.id);
    expect(blocks.length).toBeGreaterThan(1);

    const reversedIds = blocks
      .map((b) => b.id)
      .slice()
      .reverse();
    await blocksRepo.reorder(villaHome!.id, reversedIds);

    for (const b of await blocksRepo.findByPageId(villaHome!.id)) {
      expect(b.version).toBe(2);
    }
  });

  it('create() defaults to version 1', async () => {
    const villaHome = (await pagesRepo.listByTenant(VILLA_ID)).find((p) => p.slug === 'home');
    const created = await blocksRepo.create({
      page_id: villaHome!.id,
      block_type: 'text',
      order_index: 99,
      data: { content_translations: { nl: 'fresh' } },
    });
    expect(created.version).toBe(1);
  });

  it('findById() returns null for an unknown id', async () => {
    const result = await blocksRepo.findById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });
});
