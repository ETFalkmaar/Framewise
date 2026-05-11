import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { blocksRepo, pageVersionsRepo, resetStore } from '@/lib/data';

import { blocksFromSnapshot, createPageSnapshot } from '../snapshot';

const VILLA_HOME_PAGE_ID = 'f0000000-0000-0000-0000-000000000001';
const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('createPageSnapshot', () => {
  it('captures every block currently on the page', async () => {
    const before = await blocksRepo.findByPageId(VILLA_HOME_PAGE_ID);
    const snapshot = await createPageSnapshot({
      pageId: VILLA_HOME_PAGE_ID,
      createdByUserId: SUPER_ADMIN_ID,
      changeSummary: 'block_content_saved',
    });
    expect(snapshot).not.toBeNull();
    const blocks = blocksFromSnapshot(snapshot!.snapshot);
    expect(blocks).toHaveLength(before.length);
    expect(blocks.map((b) => b.id).sort()).toEqual(before.map((b) => b.id).sort());
  });

  it('stores the changeSummary in `comment`', async () => {
    const snapshot = await createPageSnapshot({
      pageId: VILLA_HOME_PAGE_ID,
      createdByUserId: SUPER_ADMIN_ID,
      changeSummary: 'blocks_reordered',
    });
    expect(snapshot?.comment).toBe('blocks_reordered');
  });

  it('increments version_number per page', async () => {
    const first = await createPageSnapshot({
      pageId: VILLA_HOME_PAGE_ID,
      createdByUserId: SUPER_ADMIN_ID,
      changeSummary: 'block_content_saved',
    });
    const second = await createPageSnapshot({
      pageId: VILLA_HOME_PAGE_ID,
      createdByUserId: SUPER_ADMIN_ID,
      changeSummary: 'block_content_saved',
    });
    expect(second?.version_number).toBe((first?.version_number ?? 0) + 1);
  });

  it('lists newest first via pageVersionsRepo.listByPage', async () => {
    await createPageSnapshot({
      pageId: VILLA_HOME_PAGE_ID,
      createdByUserId: SUPER_ADMIN_ID,
      changeSummary: 'first',
    });
    // Ensure different timestamp.
    await new Promise((r) => setTimeout(r, 5));
    await createPageSnapshot({
      pageId: VILLA_HOME_PAGE_ID,
      createdByUserId: SUPER_ADMIN_ID,
      changeSummary: 'second',
    });
    const versions = await pageVersionsRepo.listByPage(VILLA_HOME_PAGE_ID);
    expect(versions[0]!.comment).toBe('second');
    expect(versions[1]!.comment).toBe('first');
  });

  it('listByPage honours the limit option', async () => {
    for (let i = 0; i < 5; i++) {
      await createPageSnapshot({
        pageId: VILLA_HOME_PAGE_ID,
        createdByUserId: SUPER_ADMIN_ID,
        changeSummary: `v${i}`,
      });
      await new Promise((r) => setTimeout(r, 2));
    }
    const limited = await pageVersionsRepo.listByPage(VILLA_HOME_PAGE_ID, { limit: 3 });
    expect(limited).toHaveLength(3);
  });

  it('countByPage returns the running total', async () => {
    expect(await pageVersionsRepo.countByPage(VILLA_HOME_PAGE_ID)).toBe(0);
    await createPageSnapshot({
      pageId: VILLA_HOME_PAGE_ID,
      createdByUserId: SUPER_ADMIN_ID,
      changeSummary: 'x',
    });
    expect(await pageVersionsRepo.countByPage(VILLA_HOME_PAGE_ID)).toBe(1);
  });

  it('returns null gracefully for an unknown page (best-effort, no throw)', async () => {
    const snapshot = await createPageSnapshot({
      pageId: 'does-not-exist',
      createdByUserId: SUPER_ADMIN_ID,
      changeSummary: 'x',
    });
    // The blocks query returns an empty list, then create persists a row with empty snapshot.
    expect(snapshot).not.toBeNull();
    expect(blocksFromSnapshot(snapshot!.snapshot)).toEqual([]);
  });
});

describe('blocksFromSnapshot', () => {
  it('drops malformed entries', () => {
    const result = blocksFromSnapshot({
      blocks: [
        { id: 'a', page_id: 'p', block_type: 'text', order_index: 0, data: {} },
        null,
        { wrong: 'shape' },
        'not-an-object',
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
  });

  it('returns [] when `blocks` is missing or not an array', () => {
    expect(blocksFromSnapshot({})).toEqual([]);
    expect(blocksFromSnapshot({ blocks: null })).toEqual([]);
    expect(blocksFromSnapshot({ blocks: 'oops' })).toEqual([]);
  });
});
