'use server';

import { revalidatePath } from 'next/cache';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import { auditLogsRepo, tenantsRepo } from '@/lib/data';
import { canCancelPublishRequest, canRequestPublish } from '@/lib/permissions/publishing';

export type PublishActionErrorCode =
  | 'unauthenticated'
  | 'no_active_tenant'
  | 'tenant_not_found'
  | 'forbidden'
  | 'repo_error';

export interface PublishActionResult {
  success: boolean;
  error?: PublishActionErrorCode;
}

/**
 * Customer-side "ask for go-live" action (step 47, fase 13 part 1/2).
 *
 * Flips `publish_request_status` to `'pending'`, stamps the
 * requester + timestamp, and writes a `site_publish_requested`
 * audit-log entry that the super-admin dashboard reads to surface
 * the pending request. Clears any prior rejection (notes,
 * timestamp, user-id) so a re-submit looks clean from the customer's
 * side.
 *
 * No-op + `forbidden` when the gate refuses — the UI only renders
 * the button when the gate would pass, so this is the second line
 * of defence against, e.g., a stale tab racing a state change.
 */
export async function requestSitePublish(): Promise<PublishActionResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'unauthenticated' };
  }

  const tenant = await getActiveTenantForUser();
  if (!tenant) return { success: false, error: 'no_active_tenant' };

  const fresh = await tenantsRepo.findById(tenant.id);
  if (!fresh) return { success: false, error: 'tenant_not_found' };

  const allowed = await canRequestPublish(user.id, fresh);
  if (!allowed) return { success: false, error: 'forbidden' };

  const now = new Date().toISOString();
  try {
    await tenantsRepo.update(tenant.id, {
      publish_request_status: 'pending',
      publish_requested_at: now,
      publish_requested_by_user_id: user.id,
      // Clear any prior rejection so the resubmit reads clean.
      publish_rejected_at: null,
      publish_rejected_by_user_id: null,
      publish_approval_notes: null,
    });
    await auditLogsRepo.create({
      tenant_id: tenant.id,
      action: 'site_publish_requested',
      performed_by_user_id: user.id,
      metadata: { tenantSlug: fresh.slug, requestedAt: now },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }

  revalidatePath('/account');
  revalidatePath('/admin/tenants');
  return { success: true };
}

/**
 * Customer-side cancel-pending-request action. Symmetric to
 * `requestSitePublish` — resets the lifecycle to `'none'` and
 * writes a `site_publish_cancelled` entry so the audit trail
 * shows who pulled it back.
 */
export async function cancelPublishRequest(): Promise<PublishActionResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'unauthenticated' };
  }

  const tenant = await getActiveTenantForUser();
  if (!tenant) return { success: false, error: 'no_active_tenant' };

  const fresh = await tenantsRepo.findById(tenant.id);
  if (!fresh) return { success: false, error: 'tenant_not_found' };

  const allowed = await canCancelPublishRequest(user.id, fresh);
  if (!allowed) return { success: false, error: 'forbidden' };

  try {
    await tenantsRepo.update(tenant.id, {
      publish_request_status: 'none',
      publish_requested_at: null,
      publish_requested_by_user_id: null,
    });
    await auditLogsRepo.create({
      tenant_id: tenant.id,
      action: 'site_publish_cancelled',
      performed_by_user_id: user.id,
      metadata: { tenantSlug: fresh.slug },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }

  revalidatePath('/account');
  revalidatePath('/admin/tenants');
  return { success: true };
}
