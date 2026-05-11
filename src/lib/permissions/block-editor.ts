import { isUserSuperAdmin } from '@/lib/auth';
import { canEditPages } from '@/lib/auth/permissions';
import type { SubscriptionPlanCode, Tenant } from '@/types/database';

/**
 * Block-editor access gate for end customers (fase 12, step 39).
 *
 * Two-axis check:
 *   1. *Role* — the user must be an editor on the tenant (owner /
 *      editor / support). Falls through to the existing
 *      `canEditPages` so we keep one source of truth for role
 *      eligibility.
 *   2. *Plan* — Basic customers don't get the editor at all.
 *      They only see connectors + checklist. Pro and Enterprise
 *      both unlock the editor.
 *
 * Super-admin always wins (we want preview / hands-on
 * troubleshooting access to every tenant regardless of plan).
 */
export async function canEditBlocks(
  userId: string,
  tenant: Tenant,
  planCode: SubscriptionPlanCode | null
): Promise<boolean> {
  if (isUserSuperAdmin(userId)) return true;
  if (planCode !== 'pro' && planCode !== 'enterprise') return false;
  return canEditPages(userId, tenant.id);
}

/**
 * Add / remove blocks is a stricter capability gated to
 * Enterprise customers. Pro customers can only *edit* existing
 * blocks — the layout is locked. Super-admin overrides.
 */
export async function canAddRemoveBlocks(
  userId: string,
  tenant: Tenant,
  planCode: SubscriptionPlanCode | null
): Promise<boolean> {
  if (isUserSuperAdmin(userId)) return true;
  if (planCode !== 'enterprise') return false;
  return canEditPages(userId, tenant.id);
}
