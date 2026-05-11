'use server';

import { revalidatePath } from 'next/cache';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import { restoreVersionFor, type RestoreVersionErrorCode } from '@/lib/blocks/restore-version';

export interface RestoreVersionInput {
  pageId: string;
  versionId: string;
}

export interface RestoreVersionResult {
  success: boolean;
  errorCode?: RestoreVersionErrorCode | 'unauthenticated' | 'no_active_tenant';
  error?: string;
  rollbackSnapshotId?: string;
}

const ERROR_MESSAGES: Record<NonNullable<RestoreVersionResult['errorCode']>, string> = {
  unauthenticated: 'Niet ingelogd',
  no_active_tenant: 'Geen actieve tenant',
  tenant_not_found: 'Tenant niet gevonden',
  page_not_found: 'Pagina niet gevonden',
  page_tenant_mismatch: 'Pagina hoort niet bij deze tenant',
  version_not_found: 'Versie niet gevonden',
  version_page_mismatch: 'Versie hoort niet bij deze pagina',
  forbidden: 'Geen rechten om versies te herstellen',
  repo_error: 'Opslaan mislukt',
};

/**
 * Server-action wrapper around `restoreVersionFor` (step 44, fase
 * 12 part 6/8). Authenticates via iron-session, resolves the
 * active tenant, then delegates to the pure core.
 */
export async function restoreVersionAction(
  input: RestoreVersionInput
): Promise<RestoreVersionResult> {
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

  const outcome = await restoreVersionFor({
    userId: user.id,
    tenantId: tenant.id,
    pageId: input.pageId,
    versionId: input.versionId,
  });

  if (!outcome.success) {
    return {
      success: false,
      errorCode: outcome.errorCode,
      error: outcome.errorCode ? ERROR_MESSAGES[outcome.errorCode] : 'Onbekende fout',
    };
  }

  revalidatePath(`/account/site/pages/${input.pageId}/edit`);
  revalidatePath(`/account/site/pages/${input.pageId}/history`);
  revalidatePath(`/sites/${tenant.slug}`);

  return { success: true, rollbackSnapshotId: outcome.rollbackSnapshotId };
}
