import type {
  Country,
  SetupChecklistItem,
  SubscriptionPlanCode,
  TenantChecklistStatus,
} from '@/types/database';
import { createRepoProxy } from './_proxy';

/**
 * Per-tenant onboarding-checklist progress.
 *
 * `setup_checklist_items` was the table-based template store before
 * step 11; templates now live in `src/lib/checklist/templates.ts`. The
 * repository keeps `getTemplateForCountryAndPlan()` for read-only
 * compatibility but new code should call into `@/lib/checklist`.
 *
 * `checklist_item_id` on a status row is now the string template id
 * (e.g. `'cw-domain'`), not a UUID — see `TenantChecklistStatus`.
 */
export interface ChecklistRepository {
  getTemplateForCountryAndPlan(
    country: Country,
    planCode: SubscriptionPlanCode
  ): Promise<SetupChecklistItem[]>;
  getTenantStatus(tenantId: string): Promise<TenantChecklistStatus[]>;
  listForTenant(tenantId: string): Promise<TenantChecklistStatus[]>;
  markCompleted(
    tenantId: string,
    checklistItemId: string,
    notes?: string | null
  ): Promise<TenantChecklistStatus>;
  markPending(tenantId: string, checklistItemId: string): Promise<TenantChecklistStatus>;
  markSkipped(
    tenantId: string,
    checklistItemId: string,
    notes?: string | null
  ): Promise<TenantChecklistStatus>;
  reset(tenantId: string, checklistItemId: string): Promise<TenantChecklistStatus>;
  resetAll(tenantId: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<ChecklistRepository>('checklistRepo');
export const checklistRepo = proxy;
export const setChecklistRepo = set;
