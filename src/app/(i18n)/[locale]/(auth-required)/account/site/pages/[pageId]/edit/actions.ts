'use server';

import { revalidatePath } from 'next/cache';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import { reorderBlocksFor, type ReorderBlocksErrorCode } from '@/lib/blocks/reorder';

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
