import { tenantsRepo } from '@/lib/data';
import type { Tenant } from '@/types/database';

/**
 * "Recent tenants" memory for the super-admin switcher
 * (step 38, fase 11 part 4/4).
 *
 * Persisted in a plain (un-encrypted) cookie because the only
 * data is a list of UUIDs the user already has admin access to —
 * leaking it tells an attacker nothing they couldn't enumerate
 * from `/admin/tenants`. The iron-session cookie stays reserved
 * for actual auth state.
 *
 * The store is a simple LRU: most-recent first, capped at 5.
 * Reading hydrates the IDs back into `Tenant` rows and drops
 * any IDs that no longer exist (tenant was deleted), so the
 * caller never has to deal with stale data.
 */
export const RECENT_TENANTS_COOKIE = 'framewise_recent_tenants';
export const RECENT_TENANTS_LIMIT = 5;
export const RECENT_TENANTS_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function parseRecentTenantsCookie(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .slice(0, RECENT_TENANTS_LIMIT);
  } catch {
    return [];
  }
}

/**
 * Apply the LRU rules: the newest visit moves to the front, any
 * earlier occurrence of the same id is removed, and the tail is
 * trimmed to {@link RECENT_TENANTS_LIMIT}.
 */
export function updateRecentTenants(existing: string[], tenantId: string): string[] {
  const filtered = existing.filter((id) => id !== tenantId);
  return [tenantId, ...filtered].slice(0, RECENT_TENANTS_LIMIT);
}

/**
 * Hydrate a list of tenant IDs into full {@link Tenant} rows,
 * dropping unknown IDs while preserving the LRU order.
 */
export async function hydrateRecentTenants(ids: string[]): Promise<Tenant[]> {
  if (ids.length === 0) return [];
  const rows = await Promise.all(ids.map((id) => tenantsRepo.findById(id)));
  const result: Tenant[] = [];
  for (const r of rows) {
    if (r) result.push(r);
  }
  return result;
}

export function serializeRecentTenants(ids: string[]): string {
  return JSON.stringify(ids.slice(0, RECENT_TENANTS_LIMIT));
}
