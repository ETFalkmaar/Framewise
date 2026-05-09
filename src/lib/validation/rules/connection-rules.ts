import { connectionsRepo, tenantsRepo } from '@/lib/data';
import {
  countries,
  getCountryConfig,
  type CountryCode,
  type ProviderCategory,
} from '@/lib/countries';

/**
 * Returns the categories that have at least one provider configured for the
 * given country in the curated registry. Used in the UI to know which cards
 * to render and in `getRequiredConnectionsForTenant` to scope checks.
 */
export function categoriesAvailableForCountry(country: CountryCode): ProviderCategory[] {
  const config = getCountryConfig(country);
  if (!config) return [];
  const out: ProviderCategory[] = [];
  for (const [cat, ids] of Object.entries(config.providers) as Array<
    [ProviderCategory, string[]]
  >) {
    if (ids.length > 0) out.push(cat);
  }
  return out;
}

export interface RequiredConnectionStatus {
  category: ProviderCategory;
  isConfigured: boolean;
}

export interface RequiredConnectionsResult {
  required: RequiredConnectionStatus[];
  allConfigured: boolean;
}

/**
 * Looks up the country's `legalRequirements` (filtered to
 * `requiredAtLaunch`) and reports, per required category, whether the tenant
 * already has a `connected` provider connection in that category.
 *
 * The country's curated provider list is treated as authoritative: a
 * tenant in a country that has no providers in some required category
 * (which today never happens) gets `isConfigured = false`.
 */
export async function getRequiredConnectionsForTenant(
  tenantId: string
): Promise<RequiredConnectionsResult> {
  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) return { required: [], allConfigured: true };

  const country = countries[tenant.country];
  if (!country) return { required: [], allConfigured: true };

  const requiredCategories = country.legalRequirements
    .filter((r) => r.requiredAtLaunch)
    .map((r) => r.category);

  const connections = await connectionsRepo.listByTenant(tenantId);
  const connectedCategories = new Set(
    connections.filter((c) => c.status === 'connected').map((c) => c.category)
  );

  const required: RequiredConnectionStatus[] = requiredCategories.map((category) => ({
    category,
    isConfigured: connectedCategories.has(category),
  }));

  return {
    required,
    allConfigured: required.every((r) => r.isConfigured),
  };
}

export interface CanGoLiveResult {
  canGoLive: boolean;
  missingCategories: ProviderCategory[];
  reasons: string[];
}

/**
 * Aggregates the launch-readiness signals for a tenant. Today only the
 * required-connections check feeds in; step 11 will add checklist progress.
 *
 * Returns `canGoLive=true` plus an empty `missingCategories` list when the
 * tenant has every required category configured.
 */
export async function canTenantGoLive(tenantId: string): Promise<CanGoLiveResult> {
  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) {
    return {
      canGoLive: false,
      missingCategories: [],
      reasons: [`Tenant ${tenantId} not found`],
    };
  }

  const { required, allConfigured } = await getRequiredConnectionsForTenant(tenantId);
  const missing = required.filter((r) => !r.isConfigured).map((r) => r.category);

  return {
    canGoLive: allConfigured,
    missingCategories: missing,
    reasons: missing.length === 0 ? [] : missing.map((m) => `Missing required ${m} connection`),
  };
}
