'use server';

import { cookies } from 'next/headers';

import {
  RECENT_TENANTS_COOKIE,
  RECENT_TENANTS_MAX_AGE_SECONDS,
  globalSearch,
  parseRecentTenantsCookie,
  serializeRecentTenants,
  updateRecentTenants,
  type SearchResult,
} from '@/lib/admin';
import { isUserSuperAdmin, requireCurrentUser } from '@/lib/auth';
import { tenantsRepo } from '@/lib/data';

/**
 * Records a tenant visit in the LRU cookie (step 38). Called
 * client-side via the switcher / dashboard so the "Recent
 * bezocht" list always reflects what the super-admin actually
 * looked at. No-op for non-super-admin users.
 */
export async function recordTenantVisitAction(tenantId: string): Promise<{ success: boolean }> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false };
  }
  if (!isUserSuperAdmin(user.id)) return { success: false };

  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) return { success: false };

  const store = await cookies();
  const existing = parseRecentTenantsCookie(store.get(RECENT_TENANTS_COOKIE)?.value);
  const updated = updateRecentTenants(existing, tenant.id);
  store.set(RECENT_TENANTS_COOKIE, serializeRecentTenants(updated), {
    maxAge: RECENT_TENANTS_MAX_AGE_SECONDS,
    sameSite: 'lax',
    httpOnly: false,
    path: '/',
  });

  return { success: true };
}

/**
 * Server action backing the Cmd+K global search (step 38). Runs
 * the same `globalSearch` the (future) dedicated page would use
 * — exposed as an action so the client modal can fetch without
 * needing a dedicated API route.
 */
export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  const user = await requireCurrentUser();
  if (!isUserSuperAdmin(user.id)) return [];
  return globalSearch(query);
}
