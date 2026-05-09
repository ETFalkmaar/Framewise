import { connectionsRepo, tenantsRepo } from '@/lib/data';
import type { TenantChecklistStatus } from '@/types/database';

import { ensureChecklistForTenant } from './generator';
import { getTemplatesForTenant } from './generator';
import type { ChecklistItemTemplate } from './templates';

export type EffectiveChecklistStatus = 'completed' | 'pending' | 'skipped';

export interface ChecklistProgressItem {
  template: ChecklistItemTemplate;
  status: TenantChecklistStatus;
  /** True when the auto-complete source resolved to "done" right now. */
  autoCompleteResolved: boolean;
  effectiveStatus: EffectiveChecklistStatus;
}

export interface ChecklistProgress {
  total: number;
  completed: number;
  pendingRequired: number;
  pendingOptional: number;
  percentageComplete: number;
  items: ChecklistProgressItem[];
}

/**
 * Resolve a template's `autoCompleteSource` against the current store.
 *
 * - `tenant_field`: truthy iff the column is set + non-empty.
 * - `connection`: truthy iff the tenant has at least one provider in
 *   that category with status `connected`. Anything else (error,
 *   expired, disconnected) does NOT count.
 * - `manual`: always false — only the explicit DB row counts.
 */
async function resolveAutoComplete(
  tenantId: string,
  template: ChecklistItemTemplate
): Promise<boolean> {
  const source = template.autoCompleteSource;
  switch (source.type) {
    case 'manual':
      return false;
    case 'tenant_field': {
      const tenant = await tenantsRepo.findById(tenantId);
      if (!tenant) return false;
      const value = tenant[source.field];
      return typeof value === 'string' && value.length > 0;
    }
    case 'connection': {
      const conns = await connectionsRepo.findByCategory(tenantId, source.category);
      return conns.some((c) => c.status === 'connected');
    }
  }
}

/**
 * Convert a stored status + auto-complete signal into the effective
 * status the UI renders.
 *
 * Precedence:
 *   1. user-set `skipped` overrides everything (user said "don't bug me")
 *   2. auto-complete `true` → completed
 *   3. user-set `completed` → completed (manual confirmation)
 *   4. otherwise pending
 */
function deriveEffectiveStatus(
  stored: TenantChecklistStatus,
  autoCompleteResolved: boolean
): EffectiveChecklistStatus {
  if (stored.status === 'skipped') return 'skipped';
  if (autoCompleteResolved) return 'completed';
  if (stored.status === 'completed') return 'completed';
  return 'pending';
}

/**
 * Compute progress for the tenant. Calls `ensureChecklistForTenant`
 * first so freshly applicable templates are always represented.
 */
export async function computeChecklistProgress(tenantId: string): Promise<ChecklistProgress> {
  const [templates, statuses] = await Promise.all([
    getTemplatesForTenant(tenantId),
    ensureChecklistForTenant(tenantId),
  ]);

  if (templates.length === 0) {
    return {
      total: 0,
      completed: 0,
      pendingRequired: 0,
      pendingOptional: 0,
      percentageComplete: 0,
      items: [],
    };
  }

  const items: ChecklistProgressItem[] = [];
  for (const template of templates) {
    const stored =
      statuses.find((s) => s.checklist_item_id === template.id) ??
      ({
        id: '',
        tenant_id: tenantId,
        checklist_item_id: template.id,
        status: 'pending',
        completed_at: null,
        notes: null,
      } satisfies TenantChecklistStatus);

    const autoCompleteResolved = await resolveAutoComplete(tenantId, template);
    const effectiveStatus = deriveEffectiveStatus(stored, autoCompleteResolved);

    items.push({ template, status: stored, autoCompleteResolved, effectiveStatus });
  }

  const completed = items.filter(
    (i) => i.effectiveStatus === 'completed' || i.effectiveStatus === 'skipped'
  ).length;
  const pendingRequired = items.filter(
    (i) => i.effectiveStatus === 'pending' && i.template.required
  ).length;
  const pendingOptional = items.filter(
    (i) => i.effectiveStatus === 'pending' && !i.template.required
  ).length;

  const total = items.length;
  const percentageComplete = total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    pendingRequired,
    pendingOptional,
    percentageComplete,
    items,
  };
}
