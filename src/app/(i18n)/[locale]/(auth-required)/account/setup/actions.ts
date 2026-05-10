'use server';

import { revalidatePath } from 'next/cache';
import { checklistRepo } from '@/lib/data';
import {
  assertCanManageTenant,
  getActiveTenantForUser,
  isUserSuperAdmin,
  requireCurrentUser,
} from '@/lib/auth';
import { getTemplateById } from '@/lib/checklist';
import {
  type PublishResult,
  publishSite as publishSiteCore,
  unpublishSite as unpublishSiteCore,
} from '@/lib/site-lifecycle';
import { ValidationError, VALIDATION_ERROR_CODES } from '@/lib/validation';

async function resolveTenantAndTemplate(formData: FormData) {
  const templateId = String(formData.get('templateId') ?? '');
  const user = await requireCurrentUser();
  const tenant = await getActiveTenantForUser();
  if (!tenant) {
    throw new ValidationError(
      VALIDATION_ERROR_CODES.NOT_FOUND,
      'No active tenant for current session',
      { field: 'tenant_id' }
    );
  }
  // Super-admin bypasses tenant role checks (consistent with the rest of
  // the auth helpers).
  if (!isUserSuperAdmin(user.id)) {
    await assertCanManageTenant(user.id, tenant.id);
  }
  const template = getTemplateById(templateId);
  if (!template) {
    throw new ValidationError(
      VALIDATION_ERROR_CODES.NOT_FOUND,
      `Unknown checklist template ${templateId}`,
      { field: 'templateId' }
    );
  }
  if (template.actionType !== 'manual') {
    throw new ValidationError(
      VALIDATION_ERROR_CODES.INVALID_INPUT,
      `Cannot manually update auto-complete item ${templateId}`,
      { field: 'templateId' }
    );
  }
  return { tenant, template };
}

export async function markItemCompletedAction(formData: FormData): Promise<void> {
  const { tenant, template } = await resolveTenantAndTemplate(formData);
  await checklistRepo.markCompleted(tenant.id, template.id);
  revalidatePath('/account/setup');
  revalidatePath('/account');
}

export async function markItemPendingAction(formData: FormData): Promise<void> {
  const { tenant, template } = await resolveTenantAndTemplate(formData);
  await checklistRepo.markPending(tenant.id, template.id);
  revalidatePath('/account/setup');
  revalidatePath('/account');
}

export async function markItemSkippedAction(formData: FormData): Promise<void> {
  const { tenant, template } = await resolveTenantAndTemplate(formData);
  await checklistRepo.markSkipped(tenant.id, template.id);
  revalidatePath('/account/setup');
  revalidatePath('/account');
}

/**
 * Step 32: super-admin publishes the tenant. Gated by
 * `isUserSuperAdmin` here and again inside `publishSiteCore` so a
 * direct POST can't slip past the wizard.
 */
export async function publishSiteAction(): Promise<PublishResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'Niet ingelogd' };
  }
  if (!isUserSuperAdmin(user.id)) {
    return { success: false, error: 'Alleen de super-admin kan publiceren' };
  }
  const tenant = await getActiveTenantForUser();
  if (!tenant) return { success: false, error: 'Geen actieve tenant' };

  const result = await publishSiteCore({
    tenantId: tenant.id,
    performedByUserId: user.id,
  });
  if (result.success) {
    revalidatePath('/account/setup');
    revalidatePath('/account');
    revalidatePath(`/sites/${tenant.slug}`);
  }
  return result;
}

/**
 * Step 32: super-admin pulls the site back to maintenance (status
 * `paused`). The `reason` is recorded in the audit log only.
 */
export async function unpublishSiteAction(reason?: string): Promise<PublishResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'Niet ingelogd' };
  }
  if (!isUserSuperAdmin(user.id)) {
    return { success: false, error: 'Alleen de super-admin kan een site offline halen' };
  }
  const tenant = await getActiveTenantForUser();
  if (!tenant) return { success: false, error: 'Geen actieve tenant' };

  const result = await unpublishSiteCore({
    tenantId: tenant.id,
    performedByUserId: user.id,
    reason,
  });
  if (result.success) {
    revalidatePath('/account/setup');
    revalidatePath('/account');
    revalidatePath(`/sites/${tenant.slug}`);
  }
  return result;
}
