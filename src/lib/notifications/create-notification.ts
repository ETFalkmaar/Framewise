import { isUserSuperAdmin } from '@/lib/auth';
import { notificationsRepo, usersRepo } from '@/lib/data';

/**
 * Notification helpers for the publish-request lifecycle (step 48,
 * fase 13 part 2/2). Each function maps one product event to:
 *
 *  1. One `notificationsRepo.create` call per recipient.
 *  2. Optional follow-up `queueEmail` (wired by the caller — keeps
 *     the helpers single-purpose).
 *
 * Notifications use stable `type` codes; the renderer picks the
 * icon + localised category label from the code, so the title/body
 * strings stored in the DB stay frozen at write time (= simple,
 * but it means an i18n shift on UI launch won't retroactively
 * relocalise old notifications — acceptable for MVP).
 */

export interface NotifyPublishRequestInput {
  tenantId: string;
  tenantName: string;
  requestedByUserId: string;
  requestedByUserName: string;
}

/**
 * Fans the publish-request out to every super-admin in the system.
 * Step 48 ships with one super-admin (`framewise@example.com`); the
 * helper is already correct for a multi-admin future.
 */
export async function notifySuperAdminsOfPublishRequest(
  input: NotifyPublishRequestInput
): Promise<void> {
  const allUsers = await usersRepo.list();
  const superAdmins = allUsers.filter((u) => isUserSuperAdmin(u.id));
  for (const admin of superAdmins) {
    await notificationsRepo.create({
      user_id: admin.id,
      tenant_id: input.tenantId,
      type: 'publish_requested',
      title: `Nieuw publicatie verzoek: ${input.tenantName}`,
      body: `${input.requestedByUserName} heeft de site klaargemaakt voor publicatie.`,
      action_url: `/admin/tenants/${input.tenantId}`,
    });
  }
}

export interface NotifyApprovalInput {
  tenantId: string;
  userId: string;
  approvedByUserName: string;
}

export async function notifyClientOfApproval(input: NotifyApprovalInput): Promise<void> {
  await notificationsRepo.create({
    user_id: input.userId,
    tenant_id: input.tenantId,
    type: 'publish_approved',
    title: '🎉 Je site is live!',
    body: `${input.approvedByUserName} heeft je site goedgekeurd. Hij is nu publiek toegankelijk.`,
    action_url: '/account',
  });
}

export interface NotifyRejectionInput {
  tenantId: string;
  userId: string;
  rejectedByUserName: string;
  notes: string;
}

export async function notifyClientOfRejection(input: NotifyRejectionInput): Promise<void> {
  await notificationsRepo.create({
    user_id: input.userId,
    tenant_id: input.tenantId,
    type: 'publish_rejected',
    title: 'Publicatie verzoek afgewezen',
    body: `Reden: ${input.notes}`,
    action_url: '/account',
  });
}
