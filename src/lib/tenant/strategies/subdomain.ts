import { tenantsRepo } from '@/lib/data';
import {
  FRAMEWISE_ROOT_HOSTS,
  stripPort,
  type TenantResolutionInput,
  type TenantResolutionResult,
} from '../types';

const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'api', 'app', 'assets']);

const SUBDOMAIN_ROOTS = [...FRAMEWISE_ROOT_HOSTS, 'localhost'] as const;

export async function resolveBySubdomain(
  input: TenantResolutionInput
): Promise<TenantResolutionResult | null> {
  const host = stripPort(input.hostname).toLowerCase();
  if (!host) return null;

  for (const root of SUBDOMAIN_ROOTS) {
    if (!host.endsWith(`.${root}`)) continue;
    const slug = host.slice(0, host.length - root.length - 1);
    if (!slug) return null;
    // Reject multi-level subdomains and reserved names.
    if (slug.includes('.')) return null;
    if (RESERVED_SUBDOMAINS.has(slug)) return null;

    const tenant = await tenantsRepo.findBySlug(slug);
    if (!tenant) return null;

    return { tenantId: tenant.id, strategy: 'subdomain', matchedSlug: slug };
  }

  return null;
}
