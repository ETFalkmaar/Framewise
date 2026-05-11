'use server';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import { pagesRepo, subscriptionsRepo } from '@/lib/data';
import { setPreviewDraft, clearPreviewDraft } from '@/lib/editor/preview-cookie';
import { canEditBlocks } from '@/lib/permissions';
import type { Block } from '@/types/database';

export interface UpdatePreviewDraftInput {
  pageId: string;
  blocks: Block[];
}

export interface UpdatePreviewDraftResult {
  success: boolean;
  error?: string;
}

/**
 * Push the editor's optimistic block list into the per-page preview
 * cookie (step 45 — fase 12 part 7/8). The iframe reads this cookie
 * back from the public site route to render uncommitted edits.
 *
 * Three security gates before the cookie is written:
 *   1. Authenticated session — anonymous requests are rejected.
 *   2. Page belongs to the user's active tenant — prevents
 *      cross-tenant draft injection.
 *   3. `canEditBlocks` (Pro/Enterprise + editor role, or super-admin)
 *      — Basic customers shouldn't be able to seed previews.
 *
 * No `revalidatePath` here — the iframe reload is triggered by the
 * client component bumping a query-string `v=` counter so we only
 * re-fetch the preview route, not the editor route.
 */
export async function updatePreviewDraft(
  input: UpdatePreviewDraftInput
): Promise<UpdatePreviewDraftResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'Niet ingelogd' };
  }

  const tenant = await getActiveTenantForUser();
  if (!tenant) return { success: false, error: 'Geen actieve tenant' };

  const page = await pagesRepo.findById(input.pageId);
  if (!page || page.tenant_id !== tenant.id) {
    return { success: false, error: 'Pagina hoort niet bij deze tenant' };
  }

  const subscription = await subscriptionsRepo.findByTenant(tenant.id);
  const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;
  const editable = await canEditBlocks(user.id, tenant, plan?.code ?? null);
  if (!editable) return { success: false, error: 'Geen rechten' };

  await setPreviewDraft({
    pageId: input.pageId,
    blocks: input.blocks,
    updatedAt: Date.now(),
  });

  return { success: true };
}

export interface ClearPreviewDraftInput {
  pageId: string;
}

/**
 * Wipe the preview cookie for a page — called when the customer
 * toggles the preview off or navigates away from the editor.
 *
 * Same security gates as `updatePreviewDraft` so a stranger can't
 * cause a cookie-clear for a tenant they don't belong to.
 */
export async function clearPreviewDraftAction(
  input: ClearPreviewDraftInput
): Promise<UpdatePreviewDraftResult> {
  // Auth gate — we only care that the call is authenticated; the user
  // object itself isn't used because the page-belongs-to-tenant check
  // below is the real authorisation.
  try {
    await requireCurrentUser();
  } catch {
    return { success: false, error: 'Niet ingelogd' };
  }

  const tenant = await getActiveTenantForUser();
  if (!tenant) return { success: false, error: 'Geen actieve tenant' };

  const page = await pagesRepo.findById(input.pageId);
  if (!page || page.tenant_id !== tenant.id) {
    return { success: false, error: 'Pagina hoort niet bij deze tenant' };
  }

  await clearPreviewDraft(input.pageId);
  return { success: true };
}
