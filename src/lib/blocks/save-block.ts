import { blocksRepo, pagesRepo, subscriptionsRepo, tenantsRepo } from '@/lib/data';
import { sanitizeHtml } from '@/lib/editor/sanitize-html';
import { canEditBlocks } from '@/lib/permissions';

/**
 * Pure (testable) implementation of the block-content save use
 * case (step 41, fase 12 part 3/8). The server action in
 * `/account/site/pages/[pageId]/edit/actions.ts` is a thin
 * wrapper that resolves the iron-session user + active tenant
 * via `next/headers` and delegates here.
 *
 * The payload is `newData`, a partial of `block.data`. We MERGE
 * with the existing `block.data` so a TipTap save of e.g.
 * `content_translations.nl` doesn't clobber `content_translations.fr`
 * or sibling fields like `alignment`. HTML-shaped values get
 * sanitised first.
 *
 * Heuristic for "this looks like HTML": any string value that
 * begins with `<` and contains `>`. Cheap, covers TipTap output,
 * doesn't punish bare strings like CTA URLs or alt text.
 */
export type SaveBlockErrorCode =
  | 'tenant_not_found'
  | 'block_not_found'
  | 'page_not_found'
  | 'page_tenant_mismatch'
  | 'forbidden'
  | 'invalid_payload'
  | 'repo_error';

export interface SaveBlockInput {
  userId: string;
  tenantId: string;
  blockId: string;
  newData: Record<string, unknown>;
}

export interface SaveBlockOutcome {
  success: boolean;
  errorCode?: SaveBlockErrorCode;
  errorDetail?: string;
}

export async function saveBlockContentFor(input: SaveBlockInput): Promise<SaveBlockOutcome> {
  if (!input.newData || typeof input.newData !== 'object') {
    return { success: false, errorCode: 'invalid_payload' };
  }

  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return { success: false, errorCode: 'tenant_not_found' };

  // `BlocksRepository` only exposes `findByPageId` today (step 119
  // adds a proper `findById` against Supabase). For the mock we
  // scan the tenant's pages until the block surfaces.
  const blockRow = await findBlockByScan(tenant.id, input.blockId);
  if (!blockRow) return { success: false, errorCode: 'block_not_found' };

  const page = await pagesRepo.findById(blockRow.page_id);
  if (!page) return { success: false, errorCode: 'page_not_found' };
  if (page.tenant_id !== tenant.id) {
    return { success: false, errorCode: 'page_tenant_mismatch' };
  }

  const subscription = await subscriptionsRepo.findByTenant(tenant.id);
  const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;
  const allowed = await canEditBlocks(input.userId, tenant, plan?.code ?? null);
  if (!allowed) return { success: false, errorCode: 'forbidden' };

  const sanitized = sanitizePayload(input.newData);
  const merged = mergeData(blockRow.data, sanitized);

  try {
    await blocksRepo.update(input.blockId, { data: merged });
  } catch (err) {
    return {
      success: false,
      errorCode: 'repo_error',
      errorDetail: err instanceof Error ? err.message : String(err),
    };
  }

  return { success: true };
}

function looksLikeHtml(value: string): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trimStart();
  return trimmed.startsWith('<') && trimmed.includes('>');
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(payload)) {
    if (raw === null || raw === undefined) {
      out[key] = raw;
    } else if (typeof raw === 'string') {
      out[key] = looksLikeHtml(raw) ? sanitizeHtml(raw) : raw;
    } else if (Array.isArray(raw)) {
      out[key] = raw.map((v) => (typeof v === 'string' && looksLikeHtml(v) ? sanitizeHtml(v) : v));
    } else if (typeof raw === 'object') {
      out[key] = sanitizePayload(raw as Record<string, unknown>);
    } else {
      out[key] = raw;
    }
  }
  return out;
}

function mergeData(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, raw] of Object.entries(patch)) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const existing = base[key];
      if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        out[key] = mergeData(existing as Record<string, unknown>, raw as Record<string, unknown>);
        continue;
      }
    }
    out[key] = raw;
  }
  return out;
}

/**
 * Mock-adapter fallback: walk pages by tenant and find the block
 * by id. Step 119 swaps to a real `findById` on `blocksRepo` and
 * this helper goes away.
 */
async function findBlockByScan(tenantId: string, blockId: string) {
  const pages = await pagesRepo.listByTenant(tenantId);
  for (const page of pages) {
    const blocks = await blocksRepo.findByPageId(page.id);
    const hit = blocks.find((b) => b.id === blockId);
    if (hit) return hit;
  }
  return null;
}
