import { headers } from 'next/headers';
import { subscriptionsRepo, tenantsRepo } from '@/lib/data';
import type { Subscription, SubscriptionPlan, Tenant } from '@/types/database';
import { TenantNotFoundError } from './errors';

export const TENANT_HEADER = 'x-framewise-tenant-id';
export const TENANT_STRATEGY_HEADER = 'x-framewise-tenant-strategy';

/**
 * Resolves the current tenant from the request headers populated by the
 * middleware. Returns `null` when no tenant context applies (the default
 * Framewise marketing site).
 */
export async function getCurrentTenant(): Promise<Tenant | null> {
  const headerStore = await headers();
  const tenantId = headerStore.get(TENANT_HEADER);
  if (!tenantId) return null;
  return tenantsRepo.findById(tenantId);
}

export async function requireCurrentTenant(): Promise<Tenant> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    throw new TenantNotFoundError();
  }
  return tenant;
}

export async function getCurrentTenantWithSubscription(): Promise<{
  tenant: Tenant;
  plan: SubscriptionPlan;
  subscription: Subscription;
} | null> {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  const [subscription, plan] = await Promise.all([
    subscriptionsRepo.findByTenant(tenant.id),
    subscriptionsRepo.findPlanById(tenant.subscription_plan_id),
  ]);

  if (!subscription || !plan) return null;
  return { tenant, plan, subscription };
}
