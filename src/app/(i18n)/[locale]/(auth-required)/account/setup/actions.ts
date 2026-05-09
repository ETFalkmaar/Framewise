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
