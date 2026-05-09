import { tenantsRepo } from '@/lib/data';
import type { TenantResolutionInput, TenantResolutionResult } from '../types';

/**
 * Match `/sites/<slug>(/whatever)?` — including a leading locale segment
 * like `/fr/sites/<slug>` so localised demo URLs keep working.
 */
const SITES_REGEX = /^(?:\/(?:nl|fr|en))?\/sites\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(\/.*)?$/;

export async function resolveByPathPrefix(
  input: TenantResolutionInput
): Promise<TenantResolutionResult | null> {
  const match = SITES_REGEX.exec(input.pathname);
  if (!match) return null;

  const slug = match[1];
  const residualPath = match[2] ?? '/';

  const tenant = await tenantsRepo.findBySlug(slug);
  if (!tenant) return null;

  return {
    tenantId: tenant.id,
    strategy: 'path-prefix',
    residualPath,
    matchedSlug: slug,
  };
}
