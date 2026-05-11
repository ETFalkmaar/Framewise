import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { blocksRepo, pageVersionsRepo, resetStore } from '@/lib/data';

import { createPageSnapshot } from '@/lib/editor/snapshot';

import { restoreVersionFor } from '../restore-version';

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';
const RESTAURANT_OWNER_ID = 'a0000000-0000-0000-0000-000000000003';
const STRANGER_ID = 'a0000000-0000-0000-0000-000000000099';
const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const VILLA_HOME_PAGE_ID = 'f0000000-0000-0000-0000-000000000001';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('restoreVersionFor', () => {
  async function snapshotCurrent() {
    return createPageSnapshot({
      pageId: VILLA_HOME_PAGE_ID,
      createdByUserId: VILLA_OWNER_ID,
      changeSummary: 'test',
    });
  }

  it('replaces current blocks with the snapshot blocks', async () => {
    const snap = await snapshotCurrent();
    if (!snap) throw new Error('failed to create snapshot');

    // Mutate state: delete every block first.
    const before = await blocksRepo.findByPageId(VILLA_HOME_PAGE_ID);
    for (const b of before) await blocksRepo.delete(b.id);
    expect(await blocksRepo.findByPageId(VILLA_HOME_PAGE_ID)).toHaveLength(0);

    const result = await restoreVersionFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      versionId: snap.id,
    });
    expect(result.success).toBe(true);

    const after = await blocksRepo.findByPageId(VILLA_HOME_PAGE_ID);
    expect(after).toHaveLength(before.length);
  });

  it('creates a rollback snapshot before applying the restore', async () => {
    const snap = await snapshotCurrent();
    if (!snap) throw new Error('failed to create snapshot');

    const before = await pageVersionsRepo.countByPage(VILLA_HOME_PAGE_ID);
    const result = await restoreVersionFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      versionId: snap.id,
    });
    expect(result.rollbackSnapshotId).toBeDefined();
    const after = await pageVersionsRepo.countByPage(VILLA_HOME_PAGE_ID);
    expect(after).toBe(before + 1);
  });

  it('lets the super-admin restore', async () => {
    const snap = await snapshotCurrent();
    const result = await restoreVersionFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      versionId: snap!.id,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a stranger', async () => {
    const snap = await snapshotCurrent();
    const result = await restoreVersionFor({
      userId: STRANGER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      versionId: snap!.id,
    });
    expect(result.errorCode).toBe('forbidden');
  });

  it('rejects the restaurant owner from restoring a villa version', async () => {
    const snap = await snapshotCurrent();
    const result = await restoreVersionFor({
      userId: RESTAURANT_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      versionId: snap!.id,
    });
    expect(result.errorCode).toBe('forbidden');
  });

  it('returns tenant_not_found for an unknown tenant', async () => {
    const snap = await snapshotCurrent();
    const result = await restoreVersionFor({
      userId: VILLA_OWNER_ID,
      tenantId: '00000000-0000-0000-0000-000000000000',
      pageId: VILLA_HOME_PAGE_ID,
      versionId: snap!.id,
    });
    expect(result.errorCode).toBe('tenant_not_found');
  });

  it('returns version_not_found for an unknown id', async () => {
    const result = await restoreVersionFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      versionId: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.errorCode).toBe('version_not_found');
  });

  it('returns version_page_mismatch when the version belongs to another page', async () => {
    const snap = await snapshotCurrent();
    if (!snap) throw new Error('failed to create snapshot');
    const result = await restoreVersionFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: 'f0000000-0000-0000-0000-000000000002', // Villa /accommodation
      versionId: snap.id,
    });
    expect(result.errorCode).toBe('version_page_mismatch');
  });

  it('the restored blocks are in the original order', async () => {
    const original = await blocksRepo.findByPageId(VILLA_HOME_PAGE_ID);
    const originalOrder = original.map((b) => b.block_type);
    const snap = await snapshotCurrent();
    if (!snap) throw new Error('failed to create snapshot');

    // Scramble the live page: delete + recreate a single block.
    for (const b of original) await blocksRepo.delete(b.id);
    await blocksRepo.create({
      page_id: VILLA_HOME_PAGE_ID,
      block_type: 'text',
      order_index: 0,
      data: {},
    });

    await restoreVersionFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      pageId: VILLA_HOME_PAGE_ID,
      versionId: snap.id,
    });

    const after = await blocksRepo.findByPageId(VILLA_HOME_PAGE_ID);
    expect(after.map((b) => b.block_type)).toEqual(originalOrder);
  });
});
