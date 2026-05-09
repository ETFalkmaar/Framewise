import type {
  Country,
  SetupChecklistItem,
  SubscriptionPlanCode,
  TenantChecklistStatus,
} from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface ChecklistRepository {
  getTemplateForCountryAndPlan(
    country: Country,
    planCode: SubscriptionPlanCode
  ): Promise<SetupChecklistItem[]>;
  getTenantStatus(tenantId: string): Promise<TenantChecklistStatus[]>;
  markCompleted(
    tenantId: string,
    checklistItemId: string,
    notes?: string | null
  ): Promise<TenantChecklistStatus>;
  reset(tenantId: string, checklistItemId: string): Promise<TenantChecklistStatus>;
}

const { proxy, set } = createRepoProxy<ChecklistRepository>('checklistRepo');
export const checklistRepo = proxy;
export const setChecklistRepo = set;
