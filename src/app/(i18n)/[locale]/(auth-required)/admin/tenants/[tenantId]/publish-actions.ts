'use server';

import { revalidatePath } from 'next/cache';

import { requireCurrentUser } from '@/lib/auth';
import { findTenantOwnerUserId } from '@/lib/auth/find-tenant-owner';
import { auditLogsRepo, tenantsRepo, usersRepo } from '@/lib/data';
import {
  notifyClientOfApproval,
  notifyClientOfRejection,
} from '@/lib/notifications/create-notification';
import { queueEmail } from '@/lib/notifications/email-stub';
import { canApprovePublishRequest } from '@/lib/permissions/publishing';

export type AdminPublishErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'tenant_not_found'
  | 'not_pending'
  | 'notes_too_short'
  | 'repo_error';

export interface AdminPublishResult {
  success: boolean;
  error?: AdminPublishErrorCode;
}

const REJECT_NOTES_MIN_CHARS = 10;

/**
 * Super-admin "approve" action (step 47). Sets the tenant's
 * `publish_request_status` to `'approved'`, flips `tenant.status`
 * to `'live'` so the site goes public, records the timestamp +
 * approver. The customer's banner switches to the celebration
 * state on its next render.
 *
 * Notes are optional on approve (the spec allows the super-admin
 * to add an internal comment; nothing in the customer UI surfaces
 * them yet but they live in the audit trail for later).
 */
export async function approvePublishRequest(input: {
  tenantId: string;
  notes?: string;
}): Promise<AdminPublishResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'unauthenticated' };
  }

  if (!canApprovePublishRequest(user.id)) {
    return { success: false, error: 'forbidden' };
  }

  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return { success: false, error: 'tenant_not_found' };
  if (tenant.publish_request_status !== 'pending') {
    return { success: false, error: 'not_pending' };
  }

  const now = new Date().toISOString();
  try {
    await tenantsRepo.update(tenant.id, {
      status: 'live',
      publish_request_status: 'approved',
      publish_approved_at: now,
      publish_approved_by_user_id: user.id,
      publish_approval_notes: input.notes?.trim() ? input.notes.trim() : null,
    });
    await auditLogsRepo.create({
      tenant_id: tenant.id,
      action: 'site_publish_approved',
      performed_by_user_id: user.id,
      metadata: {
        tenantSlug: tenant.slug,
        notes: input.notes?.trim() ?? null,
        requestedAt: tenant.publish_requested_at,
        requestedByUserId: tenant.publish_requested_by_user_id,
      },
    });
    // Step 48 — celebrate the customer.
    try {
      const ownerUserId = await findTenantOwnerUserId(tenant.id);
      if (ownerUserId) {
        await notifyClientOfApproval({
          tenantId: tenant.id,
          userId: ownerUserId,
          approvedByUserName: user.name,
        });
        const owner = await usersRepo.findById(ownerUserId);
        if (owner) {
          await queueEmail({
            to: owner.email,
            subject: '🎉 Je site is live!',
            body: `${user.name} heeft ${tenant.name} goedgekeurd. Bekijk je site op /sites/${tenant.slug}.`,
            tenantId: tenant.id,
            metadata: { event: 'publish_approved', ownerUserId },
          });
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[step-48] notify on approval failed', err);
    }
  } catch {
    return { success: false, error: 'repo_error' };
  }

  revalidatePath('/account');
  revalidatePath('/admin/tenants');
  revalidatePath(`/admin/tenants/${input.tenantId}`);
  return { success: true };
}

/**
 * Super-admin "reject" action. Records the rejection with a
 * required `notes` field (≥10 chars) so the customer sees actionable
 * feedback. Leaves `tenant.status` unchanged — only the
 * `publish_request_status` lifecycle moves to `'rejected'`. The
 * customer can resubmit; that path clears the rejection fields
 * (see `requestSitePublish`).
 */
export async function rejectPublishRequest(input: {
  tenantId: string;
  notes: string;
}): Promise<AdminPublishResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'unauthenticated' };
  }

  if (!canApprovePublishRequest(user.id)) {
    return { success: false, error: 'forbidden' };
  }

  const trimmed = input.notes?.trim() ?? '';
  if (trimmed.length < REJECT_NOTES_MIN_CHARS) {
    return { success: false, error: 'notes_too_short' };
  }

  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return { success: false, error: 'tenant_not_found' };
  if (tenant.publish_request_status !== 'pending') {
    return { success: false, error: 'not_pending' };
  }

  const now = new Date().toISOString();
  try {
    await tenantsRepo.update(tenant.id, {
      publish_request_status: 'rejected',
      publish_rejected_at: now,
      publish_rejected_by_user_id: user.id,
      publish_approval_notes: trimmed,
    });
    await auditLogsRepo.create({
      tenant_id: tenant.id,
      action: 'site_publish_rejected',
      performed_by_user_id: user.id,
      metadata: {
        tenantSlug: tenant.slug,
        notes: trimmed,
      },
    });
    // Step 48 — notify the customer with the rejection rationale.
    try {
      const ownerUserId = await findTenantOwnerUserId(tenant.id);
      if (ownerUserId) {
        await notifyClientOfRejection({
          tenantId: tenant.id,
          userId: ownerUserId,
          rejectedByUserName: user.name,
          notes: trimmed,
        });
        const owner = await usersRepo.findById(ownerUserId);
        if (owner) {
          await queueEmail({
            to: owner.email,
            subject: 'Publicatie verzoek afgewezen',
            body: `Reden: ${trimmed}`,
            tenantId: tenant.id,
            metadata: { event: 'publish_rejected', ownerUserId, notes: trimmed },
          });
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[step-48] notify on rejection failed', err);
    }
  } catch {
    return { success: false, error: 'repo_error' };
  }

  revalidatePath('/account');
  revalidatePath('/admin/tenants');
  revalidatePath(`/admin/tenants/${input.tenantId}`);
  return { success: true };
}
