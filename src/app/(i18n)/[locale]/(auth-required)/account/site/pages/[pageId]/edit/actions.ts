'use server';

import { revalidatePath } from 'next/cache';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import { reorderBlocksFor, type ReorderBlocksErrorCode } from '@/lib/blocks/reorder';
import { saveBlockContentFor, type SaveBlockErrorCode } from '@/lib/blocks/save-block';

export interface ReorderBlocksInput {
  pageId: string;
  newOrder: string[];
}

export interface ReorderBlocksResult {
  success: boolean;
  errorCode?: ReorderBlocksErrorCode | 'unauthenticated' | 'no_active_tenant';
  error?: string;
}

const ERROR_MESSAGES: Record<NonNullable<ReorderBlocksResult['errorCode']>, string> = {
  unauthenticated: 'Niet ingelogd',
  no_active_tenant: 'Geen actieve tenant',
  tenant_not_found: 'Tenant niet gevonden',
  page_not_found: 'Pagina niet gevonden',
  page_tenant_mismatch: 'Pagina hoort niet bij deze tenant',
  forbidden: 'Geen rechten om de volgorde te wijzigen',
  count_mismatch: 'Aantal blokken klopt niet',
  duplicate_ids: 'Dubbele block IDs in volgorde',
  unknown_block_id: 'Onbekend block id',
  repo_error: 'Opslaan mislukt',
};

/**
 * Server-action wrapper around `reorderBlocksFor` (step 40, fase
 * 12 part 2/8). The thin shell here resolves the active session
 * + active tenant via `next/headers`, then delegates the actual
 * validation + persistence to the pure core function (which is
 * what the unit tests exercise).
 *
 * Revalidates both the editor route and the public site path so
 * the live preview reflects the new ordering on the next request.
 */
export async function reorderBlocksAction(input: ReorderBlocksInput): Promise<ReorderBlocksResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, errorCode: 'unauthenticated', error: ERROR_MESSAGES.unauthenticated };
  }

  const tenant = await getActiveTenantForUser();
  if (!tenant) {
    return {
      success: false,
      errorCode: 'no_active_tenant',
      error: ERROR_MESSAGES.no_active_tenant,
    };
  }

  const outcome = await reorderBlocksFor({
    userId: user.id,
    tenantId: tenant.id,
    pageId: input.pageId,
    newOrder: input.newOrder,
  });

  if (!outcome.success) {
    return {
      success: false,
      errorCode: outcome.errorCode,
      error: outcome.errorCode ? ERROR_MESSAGES[outcome.errorCode] : 'Onbekende fout',
    };
  }

  revalidatePath(`/account/site/pages/${input.pageId}/edit`);
  revalidatePath(`/sites/${tenant.slug}`);

  return { success: true };
}

export interface SaveBlockContentInput {
  pageId: string;
  blockId: string;
  newData: Record<string, unknown>;
  /** Step 46 — pin the block version observed by the editor; the
   * action returns `conflict: true` if the persisted block has
   * moved on since. Omit to force-save without the check. */
  expectedVersion?: number;
}

export interface SaveBlockContentResult {
  success: boolean;
  errorCode?: SaveBlockErrorCode | 'unauthenticated' | 'no_active_tenant';
  error?: string;
  /** Step 46 — `true` when a version mismatch caused the save to
   * abort. The client should show a conflict dialog rather than
   * treating this as a generic error. */
  conflict?: boolean;
  /** Step 46 — current block on conflict so the dialog can render
   * the server-side data alongside the user's local changes. */
  currentBlock?: import('@/types/database').Block;
  /** Step 46 — fresh version on success so the form can pin its
   * `expectedVersion` for the next save. */
  newVersion?: number;
}

const SAVE_BLOCK_ERROR_MESSAGES: Record<
  NonNullable<SaveBlockContentResult['errorCode']>,
  string
> = {
  unauthenticated: 'Niet ingelogd',
  no_active_tenant: 'Geen actieve tenant',
  tenant_not_found: 'Tenant niet gevonden',
  block_not_found: 'Block niet gevonden',
  page_not_found: 'Pagina niet gevonden',
  page_tenant_mismatch: 'Block hoort niet bij deze tenant',
  forbidden: 'Geen rechten om dit block te bewerken',
  invalid_payload: 'Ongeldige invoer',
  repo_error: 'Opslaan mislukt',
};

/**
 * Server-action wrapper around `saveBlockContentFor` (step 41,
 * fase 12 part 3/8). Customer-facing block-edit forms (text,
 * hero, image, …) all call this with a `newData` patch. The pure
 * core handles HTML sanitisation + nested merge so a TipTap save
 * of `content_translations.nl` doesn't clobber FR/EN siblings.
 *
 * Revalidates both the editor route and the public site path so
 * the live preview picks up the new content on the next request.
 */
export async function saveBlockContentAction(
  input: SaveBlockContentInput
): Promise<SaveBlockContentResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return {
      success: false,
      errorCode: 'unauthenticated',
      error: SAVE_BLOCK_ERROR_MESSAGES.unauthenticated,
    };
  }

  const tenant = await getActiveTenantForUser();
  if (!tenant) {
    return {
      success: false,
      errorCode: 'no_active_tenant',
      error: SAVE_BLOCK_ERROR_MESSAGES.no_active_tenant,
    };
  }

  const outcome = await saveBlockContentFor({
    userId: user.id,
    tenantId: tenant.id,
    blockId: input.blockId,
    newData: input.newData,
    expectedVersion: input.expectedVersion,
  });

  if (!outcome.success) {
    // Step 46 — conflicts are not generic errors; surface the
    // server-side block so the dialog can show both sides.
    if (outcome.conflict) {
      return {
        success: false,
        conflict: true,
        currentBlock: outcome.currentBlock,
        error: 'Iemand anders heeft dit blok ook bewerkt.',
      };
    }
    return {
      success: false,
      errorCode: outcome.errorCode,
      error: outcome.errorCode ? SAVE_BLOCK_ERROR_MESSAGES[outcome.errorCode] : 'Onbekende fout',
    };
  }

  revalidatePath(`/account/site/pages/${input.pageId}/edit`);
  revalidatePath(`/sites/${tenant.slug}`);

  return { success: true, newVersion: outcome.newVersion };
}
