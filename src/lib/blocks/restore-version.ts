import {
  blocksRepo,
  pagesRepo,
  pageVersionsRepo,
  subscriptionsRepo,
  tenantsRepo,
} from '@/lib/data';
import { blocksFromSnapshot, createPageSnapshot } from '@/lib/editor/snapshot';
import { canEditBlocks } from '@/lib/permissions';
import type { Block } from '@/types/database';

/**
 * Pure (testable) implementation of the "restore a version" use
 * case (step 44, fase 12 part 6/8). Called by the history
 * action's thin server wrapper.
 *
 * Flow:
 *   1. Permission + tenant + version lookups.
 *   2. Snapshot the *current* state so the user can also undo
 *      the restore (defence: a restore is also just one click).
 *   3. Replace every block on the page with the snapshotted ones.
 *
 * Step 119's Supabase swap-in lands the replace step on a
 * single transaction; the mock-adapter version is two passes
 * (delete-then-create) and `Promise.all` isn't atomic — that's
 * fine for development.
 */
export type RestoreVersionErrorCode =
  | 'tenant_not_found'
  | 'page_not_found'
  | 'page_tenant_mismatch'
  | 'version_not_found'
  | 'version_page_mismatch'
  | 'forbidden'
  | 'repo_error';

export interface RestoreVersionInput {
  userId: string;
  tenantId: string;
  pageId: string;
  versionId: string;
}

export interface RestoreVersionOutcome {
  success: boolean;
  errorCode?: RestoreVersionErrorCode;
  errorDetail?: string;
  /** The fresh snapshot taken just before applying the restore. */
  rollbackSnapshotId?: string;
}

export async function restoreVersionFor(
  input: RestoreVersionInput
): Promise<RestoreVersionOutcome> {
  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return { success: false, errorCode: 'tenant_not_found' };

  const page = await pagesRepo.findById(input.pageId);
  if (!page) return { success: false, errorCode: 'page_not_found' };
  if (page.tenant_id !== tenant.id) {
    return { success: false, errorCode: 'page_tenant_mismatch' };
  }

  const subscription = await subscriptionsRepo.findByTenant(tenant.id);
  const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;
  const allowed = await canEditBlocks(input.userId, tenant, plan?.code ?? null);
  if (!allowed) return { success: false, errorCode: 'forbidden' };

  const version = await pageVersionsRepo.findById(input.versionId);
  if (!version) return { success: false, errorCode: 'version_not_found' };
  if (version.page_id !== page.id) {
    return { success: false, errorCode: 'version_page_mismatch' };
  }

  const snapshotBlocks = blocksFromSnapshot(version.snapshot);

  const rollback = await createPageSnapshot({
    pageId: page.id,
    createdByUserId: input.userId,
    changeSummary: 'version_restored',
  });

  try {
    await replaceBlocks(page.id, snapshotBlocks);
  } catch (err) {
    return {
      success: false,
      errorCode: 'repo_error',
      errorDetail: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    success: true,
    rollbackSnapshotId: rollback?.id,
  };
}

async function replaceBlocks(pageId: string, snapshotBlocks: Block[]): Promise<void> {
  const current = await blocksRepo.findByPageId(pageId);
  for (const block of current) {
    await blocksRepo.delete(block.id);
  }
  // Recreate in the snapshot's order.
  for (let i = 0; i < snapshotBlocks.length; i++) {
    const b = snapshotBlocks[i]!;
    await blocksRepo.create({
      page_id: pageId,
      block_type: b.block_type,
      order_index: i,
      data: b.data,
    });
  }
}
