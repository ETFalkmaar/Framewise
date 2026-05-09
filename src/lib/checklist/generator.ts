import { checklistRepo, subscriptionsRepo, tenantsRepo } from '@/lib/data';
import type { CountryCode } from '@/lib/countries';
import type { SubscriptionPlanCode, TenantChecklistStatus } from '@/types/database';

import { getTemplatesForCountryAndPlan, type ChecklistItemTemplate } from './templates';

/**
 * Resolve the templates that apply to a tenant by combining its country
 * and subscription plan. Returns `[]` if either lookup fails.
 */
export async function getTemplatesForTenant(tenantId: string): Promise<ChecklistItemTemplate[]> {
  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) return [];

  const subscription = await subscriptionsRepo.findByTenant(tenantId);
  const planId = subscription?.plan_id ?? tenant.subscription_plan_id;
  const plan = await subscriptionsRepo.findPlanById(planId);
  if (!plan) return [];

  return getTemplatesForCountryAndPlan(
    tenant.country as CountryCode,
    plan.code as SubscriptionPlanCode
  );
}

/**
 * Idempotently insert a `tenant_checklist_status` row (status `pending`)
 * for every applicable template that doesn't already have one. Existing
 * rows are left untouched, so a user's manual `completed`/`skipped`
 * decisions survive across calls.
 */
export async function ensureChecklistForTenant(tenantId: string): Promise<TenantChecklistStatus[]> {
  const templates = await getTemplatesForTenant(tenantId);
  if (templates.length === 0) return [];

  const existing = await checklistRepo.getTenantStatus(tenantId);
  const known = new Set(existing.map((row) => row.checklist_item_id));

  for (const template of templates) {
    if (known.has(template.id)) continue;
    await checklistRepo.markPending(tenantId, template.id);
  }

  return checklistRepo.getTenantStatus(tenantId);
}
