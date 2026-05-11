import { connectionsRepo, tenantsRepo } from '@/lib/data';
import { computeChecklistProgress } from '@/lib/checklist';
import { canTenantGoLive } from '@/lib/validation';

/**
 * Per-tenant numbers the super-admin overview hydrates each row
 * with (step 35, fase 11). Kept separate from the heavier
 * `ChecklistProgress` so the table only needs `Promise.all` over
 * a single tenant id × stats call instead of recomputing the full
 * progress object inside the row.
 */
export interface TenantStats {
  tenantId: string;
  /** 0–100, percentage of all checklist items in a completed/skipped state. */
  checklistPercentage: number;
  /** How many checklist items the (country, plan) template surfaces. */
  checklistTotal: number;
  /** Of which: how many are completed / skipped. */
  checklistCompleted: number;
  /** Required slice — drives the "ready to publish" gate. */
  checklistRequiredTotal: number;
  checklistRequiredCompleted: number;
  /** Mirror of `canTenantGoLive(tenantId).canGoLive` so the row can flag publishable tenants. */
  canGoLive: boolean;
  /** Active provider connections — proxy for "tenant has wired up its toolbox". */
  activeConnectorCount: number;
  /** Days between the seeded `created_at` and "now" (rounded down). */
  daysOld: number;
  /**
   * Last activity timestamp. The mock adapter has no audit log
   * yet, so we approximate via `tenants.updated_at` — step 88
   * swaps this for real audit data.
   */
  lastActivityAt: string | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function calculateTenantStats(tenantId: string): Promise<TenantStats | null> {
  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) return null;

  const [progress, goLive, connections] = await Promise.all([
    computeChecklistProgress(tenantId),
    canTenantGoLive(tenantId),
    connectionsRepo.findActive(tenantId),
  ]);

  const total = progress.total;
  const completed = total - progress.pendingRequired - progress.pendingOptional;
  const requiredTotal = progress.items.filter((i) => i.template.required).length;
  const requiredCompleted = requiredTotal - progress.pendingRequired;
  const percentage = total === 0 ? 100 : Math.round((completed / total) * 100);

  const createdAt = Date.parse(tenant.created_at);
  const daysOld = Number.isNaN(createdAt)
    ? 0
    : Math.max(0, Math.floor((Date.now() - createdAt) / MS_PER_DAY));

  return {
    tenantId,
    checklistPercentage: percentage,
    checklistTotal: total,
    checklistCompleted: completed,
    checklistRequiredTotal: requiredTotal,
    checklistRequiredCompleted: requiredCompleted,
    canGoLive: goLive.canGoLive,
    activeConnectorCount: connections.length,
    daysOld,
    lastActivityAt: tenant.updated_at,
  };
}
