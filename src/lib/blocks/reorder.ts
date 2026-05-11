import { blocksRepo, pagesRepo, subscriptionsRepo, tenantsRepo } from '@/lib/data';
import { canEditBlocks } from '@/lib/permissions';

/**
 * Pure (testable) implementation of the block-reorder use case
 * (step 40, fase 12 part 2/8). The server action in the
 * /account/site/pages/[pageId]/edit route is a thin wrapper that
 * pulls the active user via the iron-session helper and delegates
 * here, so the validation logic stays unit-testable without
 * mocking `cookies()` / `next/headers`.
 *
 * Error codes are short, stable identifiers — the action maps
 * them to localised strings using the i18n bundle.
 */
export type ReorderBlocksErrorCode =
  | 'tenant_not_found'
  | 'page_not_found'
  | 'page_tenant_mismatch'
  | 'forbidden'
  | 'count_mismatch'
  | 'duplicate_ids'
  | 'unknown_block_id'
  | 'repo_error';

export interface ReorderBlocksInput {
  userId: string;
  tenantId: string;
  pageId: string;
  newOrder: string[];
}

export interface ReorderBlocksOutcome {
  success: boolean;
  errorCode?: ReorderBlocksErrorCode;
  errorDetail?: string;
}

export async function reorderBlocksFor(input: ReorderBlocksInput): Promise<ReorderBlocksOutcome> {
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

  const existing = await blocksRepo.findByPageId(input.pageId);
  if (existing.length !== input.newOrder.length) {
    return { success: false, errorCode: 'count_mismatch' };
  }
  if (new Set(input.newOrder).size !== input.newOrder.length) {
    return { success: false, errorCode: 'duplicate_ids' };
  }
  const existingIds = new Set(existing.map((b) => b.id));
  for (const id of input.newOrder) {
    if (!existingIds.has(id)) {
      return { success: false, errorCode: 'unknown_block_id', errorDetail: id };
    }
  }

  try {
    await blocksRepo.reorder(input.pageId, input.newOrder);
  } catch (err) {
    return {
      success: false,
      errorCode: 'repo_error',
      errorDetail: err instanceof Error ? err.message : String(err),
    };
  }

  return { success: true };
}
