import type { Tenant } from '@/types/database';
import { isUserSuperAdmin } from '@/lib/auth';
import { canEditPages } from '@/lib/auth/permissions';

/**
 * Publish-request permissions (step 47, fase 13 part 1/2).
 *
 * The "site" in the spec maps to `Tenant` in this codebase — one
 * tenant owns one publishable site. State lives on `tenant.status`
 * (`onboarding` / `live` / `paused` / `cancelled`) plus the new
 * `publish_request_status` lifecycle field.
 *
 * Three gates:
 *   - `canRequestPublish` — the customer-side "ask for go-live" button.
 *     Available to tenant owners whose site is not already live or
 *     awaiting approval. Super-admin bypasses (we want them to be
 *     able to seed a request from the admin view for debugging).
 *   - `canCancelPublishRequest` — pull-back of a pending request.
 *     Same role + super-admin override; only meaningful when status
 *     is `pending`.
 *   - `canApprovePublishRequest` — gated to super-admin only.
 *     Customers are never allowed to approve their own request
 *     even with the bypass — the workflow requires a second pair
 *     of eyes.
 */
export async function canRequestPublish(userId: string, tenant: Tenant): Promise<boolean> {
  if (isUserSuperAdmin(userId)) return true;
  // Must be an editor (owner / editor / support role) on this tenant.
  const allowed = await canEditPages(userId, tenant.id);
  if (!allowed) return false;
  // Site already live — re-requesting would be a no-op + confusing.
  if (tenant.status === 'live') return false;
  // Already pending — block double-submit.
  if (tenant.publish_request_status === 'pending') return false;
  return true;
}

export async function canCancelPublishRequest(userId: string, tenant: Tenant): Promise<boolean> {
  if (isUserSuperAdmin(userId)) return true;
  const allowed = await canEditPages(userId, tenant.id);
  if (!allowed) return false;
  return tenant.publish_request_status === 'pending';
}

/**
 * Super-admin only. Tenant owners may not approve their own request
 * even if they hold both roles — the entire point of this gate is
 * the second-pair-of-eyes ceremony.
 */
export function canApprovePublishRequest(userId: string): boolean {
  return isUserSuperAdmin(userId);
}
