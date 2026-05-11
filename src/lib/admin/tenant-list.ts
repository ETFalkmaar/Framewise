import { subscriptionsRepo, tenantsRepo } from '@/lib/data';
import type { Country, SubscriptionPlanCode, Tenant, TenantStatus } from '@/types/database';

import { calculateTenantStats, type TenantStats } from './tenant-stats';

/**
 * Filters + paging the super-admin tenant overview accepts
 * (step 35, fase 11). Keeping everything optional means the
 * route can pass through `searchParams` verbatim — missing
 * keys default to "no filter".
 */
export interface TenantListFilters {
  search?: string;
  status?: TenantStatus | 'all';
  country?: Country | 'all';
  plan?: SubscriptionPlanCode | 'all';
  sortBy?: 'name' | 'created_at' | 'status' | 'plan';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface TenantWithStats extends Tenant {
  planCode: SubscriptionPlanCode | null;
  stats: TenantStats | null;
}

export interface TenantListResult {
  tenants: TenantWithStats[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 50;

/**
 * List + filter + sort + paginate tenants, then hydrate each
 * surviving row with its stats. Sort happens before paging so
 * the order is stable across pages.
 *
 * The filter chain is deliberately additive: every supplied
 * filter narrows the set further. `search` is case-insensitive
 * and matches `name`, `slug`, and `custom_domain`.
 */
export async function listTenantsForAdmin(
  filters: TenantListFilters = {}
): Promise<TenantListResult> {
  const allTenants = await tenantsRepo.list();
  const plans = await subscriptionsRepo.listPlans();
  const planById = new Map(plans.map((p) => [p.id, p]));

  // Phase 1 — filter.
  let filtered = allTenants;

  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter((t) => t.status === filters.status);
  }
  if (filters.country && filters.country !== 'all') {
    filtered = filtered.filter((t) => t.country === filters.country);
  }
  if (filters.plan && filters.plan !== 'all') {
    filtered = filtered.filter((t) => {
      const plan = planById.get(t.subscription_plan_id);
      return plan?.code === filters.plan;
    });
  }
  if (filters.search && filters.search.trim().length > 0) {
    const needle = filters.search.trim().toLowerCase();
    filtered = filtered.filter((t) => matchesSearch(t, needle));
  }

  // Phase 2 — sort.
  const sortBy = filters.sortBy ?? 'created_at';
  const sortDir = filters.sortDir ?? (sortBy === 'created_at' ? 'desc' : 'asc');
  filtered = [...filtered].sort((a, b) => {
    const result = compareTenants(a, b, sortBy, planById);
    return sortDir === 'asc' ? result : -result;
  });

  // Phase 3 — paginate.
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const currentPage = Math.max(1, filters.page ?? 1);
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = (currentPage - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  // Phase 4 — hydrate with stats.
  const tenants: TenantWithStats[] = await Promise.all(
    slice.map(async (t) => {
      const plan = planById.get(t.subscription_plan_id) ?? null;
      const stats = await calculateTenantStats(t.id);
      return { ...t, planCode: plan?.code ?? null, stats };
    })
  );

  return { tenants, totalCount, totalPages, currentPage, pageSize };
}

function matchesSearch(tenant: Tenant, needle: string): boolean {
  return (
    tenant.name.toLowerCase().includes(needle) ||
    tenant.slug.toLowerCase().includes(needle) ||
    (tenant.custom_domain?.toLowerCase().includes(needle) ?? false)
  );
}

const STATUS_ORDER: Record<TenantStatus, number> = {
  onboarding: 0,
  live: 1,
  paused: 2,
  cancelled: 3,
};

const PLAN_ORDER: Record<SubscriptionPlanCode, number> = {
  basic: 0,
  pro: 1,
  enterprise: 2,
};

function compareTenants(
  a: Tenant,
  b: Tenant,
  sortBy: NonNullable<TenantListFilters['sortBy']>,
  planById: Map<string, { code: SubscriptionPlanCode }>
): number {
  switch (sortBy) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'status':
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case 'plan': {
      const planA = planById.get(a.subscription_plan_id)?.code;
      const planB = planById.get(b.subscription_plan_id)?.code;
      const orderA = planA ? PLAN_ORDER[planA] : 99;
      const orderB = planB ? PLAN_ORDER[planB] : 99;
      return orderA - orderB;
    }
    case 'created_at':
    default:
      return Date.parse(a.created_at) - Date.parse(b.created_at);
  }
}
