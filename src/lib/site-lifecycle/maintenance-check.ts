import type { Tenant, TenantStatus } from '@/types/database';

/**
 * Decision the public route makes after resolving the tenant
 * (step 32, fase 10).
 *
 * - `public`: render the page normally.
 * - `maintenance`: render the branded maintenance shell (step 34
 *   gives it real branding; until then it's a placeholder).
 * - `404`: return `notFound()` — the tenant is closed.
 *
 * Mapping to `TenantStatus`:
 *   live              → public
 *   onboarding|paused → maintenance
 *   cancelled         → 404
 */
export type SiteRenderDecision =
  | { render: 'public' }
  | { render: 'maintenance' }
  | { render: '404' };

const MAINTENANCE_STATUSES: ReadonlySet<TenantStatus> = new Set(['onboarding', 'paused']);

export function getRenderDecisionForTenant(tenant: Tenant): SiteRenderDecision {
  if (tenant.status === 'live') return { render: 'public' };
  if (tenant.status === 'cancelled') return { render: '404' };
  if (MAINTENANCE_STATUSES.has(tenant.status)) return { render: 'maintenance' };
  // Defensive — any future enum value renders the maintenance shell so
  // we never accidentally leak a half-built site.
  return { render: 'maintenance' };
}

/**
 * Convenience for the super-admin preview bypass: when this returns
 * `true`, the public renderer should ignore the maintenance gate
 * and show the real page anyway.
 */
export function shouldBypassMaintenance(
  decision: SiteRenderDecision,
  isSuperAdmin: boolean
): boolean {
  return decision.render === 'maintenance' && isSuperAdmin;
}
