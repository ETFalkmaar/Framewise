import { tenantsRepo } from '@/lib/data';
import { canTenantGoLive } from '@/lib/validation';
import { canTransitionTo } from '@/lib/validation';
import type { TenantStatus } from '@/types/database';

/**
 * Site-publish lifecycle for the super-admin (step 32, fase 10).
 *
 * Two operations:
 *   - `publishSite`: flips the tenant to `live` after gating on
 *     `canTenantGoLive` (all required checklist items + required
 *     connections complete). The status transition itself is also
 *     gated by `canTransitionTo` so we never write an invalid
 *     enum value.
 *   - `unpublishSite`: flips the tenant back to `paused` (the
 *     status the existing maintenance render gate already
 *     recognises). Used when the super-admin wants to take the
 *     site down for an emergency fix.
 *
 * Both functions log a structured audit line via console — step 88
 * swaps this for the wider audit-log table.
 */
export type PublishErrorCode =
  | 'tenant_not_found'
  | 'already_live'
  | 'cannot_publish_cancelled'
  | 'required_items_pending'
  | 'invalid_transition'
  | 'not_currently_live';

export interface PublishResult {
  success: boolean;
  newStatus?: TenantStatus;
  errorCode?: PublishErrorCode;
  error?: string;
  /** Populated on `required_items_pending` so the UI can render specifics. */
  missingChecklistItems?: string[];
  missingCategories?: string[];
}

export interface PublishInput {
  tenantId: string;
  performedByUserId: string;
}

export interface UnpublishInput extends PublishInput {
  reason?: string;
}

/**
 * Flip the tenant to `live`. Refuses when:
 *   - the tenant is unknown
 *   - the tenant is already live
 *   - the tenant is `cancelled` (terminal)
 *   - `canTenantGoLive` reports any pending required items or
 *     missing connections
 *   - the status transition rule blocks the move (defensive — the
 *     enum-level check above should already catch this)
 */
export async function publishSite(input: PublishInput): Promise<PublishResult> {
  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) {
    return {
      success: false,
      errorCode: 'tenant_not_found',
      error: `Tenant ${input.tenantId} bestaat niet`,
    };
  }

  if (tenant.status === 'live') {
    return {
      success: false,
      errorCode: 'already_live',
      error: 'Site is al live',
    };
  }
  if (tenant.status === 'cancelled') {
    return {
      success: false,
      errorCode: 'cannot_publish_cancelled',
      error: 'Een geannuleerde tenant kan niet meer worden gepubliceerd',
    };
  }

  if (!canTransitionTo(tenant.status, 'live')) {
    return {
      success: false,
      errorCode: 'invalid_transition',
      error: `Status "${tenant.status}" → "live" is niet toegestaan`,
    };
  }

  const launchCheck = await canTenantGoLive(tenant.id);
  if (!launchCheck.canGoLive) {
    return {
      success: false,
      errorCode: 'required_items_pending',
      error: 'Niet alle verplichte items zijn voltooid',
      missingChecklistItems: launchCheck.missingChecklistItems,
      missingCategories: launchCheck.missingCategories,
    };
  }

  const updated = await tenantsRepo.update(tenant.id, { status: 'live' });

  console.log('[site-lifecycle] site_published', {
    tenantId: updated.id,
    previousStatus: tenant.status,
    performedByUserId: input.performedByUserId,
    timestamp: new Date().toISOString(),
  });

  return { success: true, newStatus: updated.status };
}

/**
 * Flip a live tenant back to `paused`. Refuses when the tenant
 * isn't currently `live` — there's nothing to unpublish.
 */
export async function unpublishSite(input: UnpublishInput): Promise<PublishResult> {
  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) {
    return {
      success: false,
      errorCode: 'tenant_not_found',
      error: `Tenant ${input.tenantId} bestaat niet`,
    };
  }

  if (tenant.status !== 'live') {
    return {
      success: false,
      errorCode: 'not_currently_live',
      error: `Tenant is niet live (huidige status: ${tenant.status})`,
    };
  }

  if (!canTransitionTo(tenant.status, 'paused')) {
    return {
      success: false,
      errorCode: 'invalid_transition',
      error: `Status "${tenant.status}" → "paused" is niet toegestaan`,
    };
  }

  const updated = await tenantsRepo.update(tenant.id, { status: 'paused' });

  console.log('[site-lifecycle] site_unpublished', {
    tenantId: updated.id,
    performedByUserId: input.performedByUserId,
    reason: input.reason ?? null,
    timestamp: new Date().toISOString(),
  });

  return { success: true, newStatus: updated.status };
}
