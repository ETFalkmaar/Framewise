import { connectionsRepo, tenantsRepo } from '@/lib/data';
import { getProviderById } from '@/lib/countries';
import type { ProviderConnection, Tenant } from '@/types/database';

/**
 * Cmd+K / `/admin/search` style cross-cutting search for the
 * super-admin (step 38, fase 11 part 4/4).
 *
 * The search runs over three indices in memory because we still
 * use the mock adapter — the real Supabase swap-in lands in step
 * 119. The data shape is fine to scale to a few thousand tenants
 * + connectors before we'd want server-side `ILIKE`/FTS.
 *
 * Results are tagged with a `type` so the UI can group them, and
 * scored 0–1 by match-quality:
 *   - 1.00 exact match (case-insensitive)
 *   - 0.85 starts-with
 *   - 0.50 contains
 *   - 0.30 fallback (only when nothing better)
 */
export type SearchResultType = 'tenant' | 'site' | 'connection';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  tenantId?: string;
  score: number;
}

export const MIN_QUERY_LENGTH = 2;
export const MAX_RESULTS = 20;

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const [tenants, allConnections] = await Promise.all([tenantsRepo.list(), listAllConnections()]);

  const results: SearchResult[] = [];

  for (const tenant of tenants) {
    const tenantScore = scoreTenant(tenant, q);
    if (tenantScore > 0) {
      results.push({
        type: 'tenant',
        id: tenant.id,
        title: tenant.name,
        subtitle: tenant.custom_domain ? `${tenant.slug} · ${tenant.custom_domain}` : tenant.slug,
        url: `/admin/tenants/${tenant.id}`,
        tenantId: tenant.id,
        score: tenantScore,
      });
    }

    const siteScore = scoreSite(tenant, q);
    if (siteScore > 0) {
      results.push({
        type: 'site',
        id: `site-${tenant.id}`,
        title: tenant.custom_domain ?? `${tenant.slug}.framewise.app`,
        subtitle: `${tenant.name} · /sites/${tenant.slug}`,
        url: `/sites/${tenant.slug}`,
        tenantId: tenant.id,
        score: siteScore,
      });
    }
  }

  for (const conn of allConnections) {
    const provider = getProviderById(conn.provider);
    const providerName = provider?.name ?? conn.provider;
    const haystack = `${providerName} ${conn.provider}`.toLowerCase();
    const connScore = scoreField(haystack, q);
    if (connScore <= 0) continue;
    const tenant = tenants.find((t) => t.id === conn.tenant_id);
    if (!tenant) continue;
    results.push({
      type: 'connection',
      id: conn.id,
      title: `${providerName} · ${tenant.name}`,
      subtitle: `${conn.category} · ${conn.status}`,
      url: `/admin/tenants/${tenant.id}#connectors`,
      tenantId: tenant.id,
      score: connScore * 0.9, // slight de-rank vs direct tenant hits
    });
  }

  results.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });

  return results.slice(0, MAX_RESULTS);
}

function scoreTenant(tenant: Tenant, q: string): number {
  const candidates = [
    tenant.name,
    tenant.slug,
    tenant.custom_domain ?? '',
    tenant.vat_number ?? '',
    tenant.crib_number ?? '',
    tenant.maintenance_contact_email ?? '',
  ];
  let best = 0;
  for (const c of candidates) {
    const s = scoreField(c.toLowerCase(), q);
    if (s > best) best = s;
  }
  return best;
}

function scoreSite(tenant: Tenant, q: string): number {
  return Math.max(
    scoreField(tenant.slug.toLowerCase(), q),
    scoreField((tenant.custom_domain ?? '').toLowerCase(), q)
  );
}

function scoreField(haystack: string, needle: string): number {
  if (!haystack) return 0;
  if (haystack === needle) return 1;
  if (haystack.startsWith(needle)) return 0.85;
  if (haystack.includes(needle)) return 0.5;
  return 0;
}

async function listAllConnections(): Promise<ProviderConnection[]> {
  const tenants = await tenantsRepo.list();
  const lists = await Promise.all(tenants.map((t) => connectionsRepo.listByTenant(t.id)));
  return lists.flat();
}
