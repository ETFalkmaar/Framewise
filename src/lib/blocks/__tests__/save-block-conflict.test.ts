import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetStore } from '@/lib/data';
import { blocksRepo } from '@/lib/data';
import { saveBlockContentFor } from '@/lib/blocks/save-block';

/**
 * Step 46 — optimistic-concurrency tests for `saveBlockContentFor`.
 * Verified separately from the step-41 happy-path tests so a future
 * audit can see the conflict semantics in one place.
 *
 * Uses the real seed data: Villa tenant (owner=Villa Owner) has a
 * `home` page with seeded blocks. `framewise` super-admin can edit
 * any tenant; villa owner can edit villa's blocks.
 */

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const VILLA_HOME_TEXT_BLOCK = '10000000-0000-0000-0000-000000000002';

describe('saveBlockContentFor — version conflict (step 46)', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it('accepts a save when expectedVersion matches the persisted block', async () => {
    const before = await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK);
    expect(before).not.toBeNull();
    const expected = before!.version;

    const result = await saveBlockContentFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { content_translations: { nl: 'first edit' } },
      expectedVersion: expected,
    });

    expect(result.success).toBe(true);
    expect(result.conflict).toBeUndefined();
    expect(result.newVersion).toBe(expected + 1);

    const after = await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK);
    expect(after?.version).toBe(expected + 1);
  });

  it('rejects with conflict when expectedVersion is stale', async () => {
    // Simulate another editor having saved by bumping the version
    // out from under us.
    await saveBlockContentFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { content_translations: { nl: 'editor A wrote this' } },
    });
    const afterA = await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK);
    expect(afterA).not.toBeNull();

    const staleVersion = afterA!.version - 1;
    const result = await saveBlockContentFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { content_translations: { nl: 'editor B writes' } },
      expectedVersion: staleVersion,
    });

    expect(result.success).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.currentBlock).toBeDefined();
    expect(result.currentBlock?.version).toBe(afterA!.version);
    // The current data must be A's edit, not B's — we never touched
    // the DB on conflict.
    const noTouch = await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK);
    expect(noTouch?.version).toBe(afterA!.version);
  });

  it('skips the version check entirely when expectedVersion is omitted', async () => {
    const before = await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK);
    expect(before).not.toBeNull();

    // No expectedVersion - this is the "force overwrite" code path
    // the conflict dialog uses for the "overwrite mine" button.
    const result = await saveBlockContentFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { content_translations: { nl: 'force-saved' } },
    });

    expect(result.success).toBe(true);
    expect(result.newVersion).toBe(before!.version + 1);
  });

  it('returns the current block in `currentBlock` on conflict so the dialog can render it', async () => {
    // Two sequential saves to build a clear server-side history.
    await saveBlockContentFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { content_translations: { nl: 'their content' } },
    });
    const theirs = await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK);

    const conflict = await saveBlockContentFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { content_translations: { nl: 'my content' } },
      expectedVersion: theirs!.version - 5, // wildly stale
    });

    expect(conflict.conflict).toBe(true);
    expect(conflict.currentBlock?.id).toBe(VILLA_HOME_TEXT_BLOCK);
    expect(conflict.currentBlock?.data).toEqual(theirs!.data);
    expect(conflict.currentBlock?.version).toBe(theirs!.version);
  });

  it('does NOT touch the DB on conflict — no snapshot, no update', async () => {
    const before = await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK);
    const beforeVersion = before!.version;
    const beforeData = JSON.stringify(before!.data);

    const result = await saveBlockContentFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { content_translations: { nl: 'rejected change' } },
      expectedVersion: beforeVersion + 99,
    });

    expect(result.conflict).toBe(true);

    const after = await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK);
    expect(after?.version).toBe(beforeVersion);
    expect(JSON.stringify(after?.data)).toBe(beforeData);
  });

  it('increments version monotonically across successive saves', async () => {
    const v0 = (await blocksRepo.findById(VILLA_HOME_TEXT_BLOCK))!.version;

    for (let i = 1; i <= 3; i++) {
      const result = await saveBlockContentFor({
        userId: SUPER_ADMIN_ID,
        tenantId: VILLA_ID,
        blockId: VILLA_HOME_TEXT_BLOCK,
        newData: { content_translations: { nl: `iteration ${i}` } },
      });
      expect(result.success).toBe(true);
      expect(result.newVersion).toBe(v0 + i);
    }
  });
});
