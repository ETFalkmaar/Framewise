import { connectionsRepo, tenantsRepo } from '@/lib/data';
import {
  countries,
  getCountryConfig,
  type CountryCode,
  type ProviderCategory,
} from '@/lib/countries';
import { computeChecklistProgress } from '@/lib/checklist';

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

/** Reasons returned by `canTenantGoLive` are structured so the UI can
 *  translate them. The `key` matches an i18n message id; `defaultMessage`
 *  is the English fallback used when the key is missing. */
export interface CanGoLiveReason {
  key: string;
  defaultMessage: string;
}

export interface CanGoLiveResult {
  canGoLive: boolean;
  /** Required *connection* categories that are still missing. */
  missingCategories: ProviderCategory[];
  /** Required *checklist* template ids that aren't completed/skipped yet. */
  missingChecklistItems: string[];
  reasons: CanGoLiveReason[];
}

/**
 * Aggregate launch-readiness signals for a tenant.
 *
 * Two gates:
 *   1. every `requiredAtLaunch` category in the country config has a
 *      `connected` provider connection; and
 *   2. every `required` checklist template has effective status
 *      `completed` or `skipped`.
 */
export async function canTenantGoLive(tenantId: string): Promise<CanGoLiveResult> {
  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) {
    return {
      canGoLive: false,
      missingCategories: [],
      missingChecklistItems: [],
      reasons: [
        {
          key: 'canGoLive.tenantNotFound',
          defaultMessage: `Tenant ${tenantId} not found`,
        },
      ],
    };
  }

  const { required } = await getRequiredConnectionsForTenant(tenantId);
  const missingCategories = required.filter((r) => !r.isConfigured).map((r) => r.category);

  const checklist = await computeChecklistProgress(tenantId);
  const missingChecklistItems = checklist.items
    .filter((i) => i.template.required && i.effectiveStatus === 'pending')
    .map((i) => i.template.id);

  const reasons: CanGoLiveReason[] = [
    ...missingCategories.map((category) => ({
      key: `canGoLive.missingConnection.${category}`,
      defaultMessage: `Missing required ${category} connection`,
    })),
    ...missingChecklistItems.map((id) => ({
      key: `canGoLive.missingChecklistItem.${id}`,
      defaultMessage: `Missing required checklist item: ${id}`,
    })),
  ];

  return {
    canGoLive: missingCategories.length === 0 && missingChecklistItems.length === 0,
    missingCategories,
    missingChecklistItems,
    reasons,
  };
}
