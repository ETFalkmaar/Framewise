import { tenantsRepo } from '@/lib/data';
import {
  FRAMEWISE_ROOT_HOSTS,
  NON_CUSTOM_HOST_SUFFIXES,
  stripPort,
  type TenantResolutionInput,
  type TenantResolutionResult,
} from '../types';

export async function resolveByCustomDomain(
  input: TenantResolutionInput
): Promise<TenantResolutionResult | null> {
  const host = stripPort(input.hostname).toLowerCase();
  if (!host) return null;

  // Skip Framewise's own roots and any platform/dev domain.
  if (FRAMEWISE_ROOT_HOSTS.includes(host as (typeof FRAMEWISE_ROOT_HOSTS)[number])) {
    return null;
  }
  if (
    NON_CUSTOM_HOST_SUFFIXES.some(
      (suffix) => host === suffix.replace(/^\./, '') || host.endsWith(suffix)
    )
  ) {
    return null;
  }

  const tenant = await tenantsRepo.findByCustomDomain(host);
  if (!tenant) return null;

  return { tenantId: tenant.id, strategy: 'custom-domain' };
}
