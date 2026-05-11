import { blocksRepo, pagesRepo, subscriptionsRepo, tenantsRepo } from '@/lib/data';
import { sanitizeHtml } from '@/lib/editor/sanitize-html';
import { createPageSnapshot } from '@/lib/editor/snapshot';
import { canEditBlocks } from '@/lib/permissions';
import type { Block } from '@/types/database';

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
 *
 * Step 46 — optimistic concurrency: callers may pass
 * `expectedVersion`. If the persisted block's `version` doesn't
 * match, we return `success: false, conflict: true` along with the
 * current block so the UI can ask the user what to do (reload
 * server version vs overwrite). Without `expectedVersion`, the
 * save proceeds unconditionally — preserving backwards
 * compatibility with the step-41 callers.
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
  /**
   * Optimistic-concurrency token (step 46). When present and the
   * persisted block's `version` differs, the save short-circuits
   * with `success: false, conflict: true` and the current block in
   * `currentBlock`. Omit to opt out of the check (e.g. for the
   * "force overwrite" path from the conflict dialog).
   */
  expectedVersion?: number;
}

export interface SaveBlockOutcome {
  success: boolean;
  errorCode?: SaveBlockErrorCode;
  errorDetail?: string;
  /** Step 46 — set to `true` when the save was rejected because the
   * `expectedVersion` didn't match the persisted block. */
  conflict?: boolean;
  /** Step 46 — populated on conflict so the UI can preview the
   * server-side version and let the user pick reload vs overwrite. */
  currentBlock?: Block;
  /** Step 46 — exposed on success so the client can pin the new
   * `expectedVersion` for the next save without an extra fetch. */
  newVersion?: number;
}

export async function saveBlockContentFor(input: SaveBlockInput): Promise<SaveBlockOutcome> {
  if (!input.newData || typeof input.newData !== 'object') {
    return { success: false, errorCode: 'invalid_payload' };
  }

  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return { success: false, errorCode: 'tenant_not_found' };

  const blockRow = await blocksRepo.findById(input.blockId);
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

  // Step 46 — optimistic concurrency. If the caller pinned a
  // version and the persisted block has moved on, reject the save
  // without touching the DB and hand back the current row so the
  // UI can render the conflict dialog (reload theirs / overwrite
  // mine). Callers that omit `expectedVersion` skip this check;
  // the manual "force overwrite" path uses that escape hatch.
  if (typeof input.expectedVersion === 'number' && blockRow.version !== input.expectedVersion) {
    return {
      success: false,
      conflict: true,
      currentBlock: blockRow,
    };
  }

  const sanitized = sanitizePayload(input.newData);
  const merged = mergeData(blockRow.data, sanitized);

  // Step 44: snapshot the current page state BEFORE we apply the
  // update so the customer can restore it from the history page.
  await createPageSnapshot({
    pageId: page.id,
    createdByUserId: input.userId,
    changeSummary: 'block_content_saved',
  });

  let updated;
  try {
    updated = await blocksRepo.update(input.blockId, { data: merged });
  } catch (err) {
    return {
      success: false,
      errorCode: 'repo_error',
      errorDetail: err instanceof Error ? err.message : String(err),
    };
  }

  return { success: true, newVersion: updated.version };
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
