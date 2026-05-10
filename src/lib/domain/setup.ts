import { tenantsRepo } from '@/lib/data';

import type { DomainSetup, DomainStatus } from './types';
import { getVercelDomainsClient } from './vercel-client';

/**
 * Domain setup orchestrator (step 33).
 *
 * Two public entry points, both super-admin–only at the route
 * layer:
 *  - `startDomainSetup`: validates the hostname, checks it isn't
 *    already attached to a different tenant, registers it with
 *    the Vercel client, writes `tenants.custom_domain`, and
 *    returns the DNS records the customer needs to add.
 *  - `verifyDomainSetup`: re-polls Vercel and updates the
 *    in-memory status. The mock client advances through the
 *    `pending_dns → ssl_pending → active` lifecycle so the
 *    wizard can be exercised without real DNS.
 */
export interface StartDomainSetupInput {
  tenantId: string;
  domain: string;
  performedByUserId: string;
}

export interface VerifyDomainSetupInput {
  tenantId: string;
  domain: string;
}

export interface DomainSetupResult {
  success: boolean;
  setup?: DomainSetup;
  errorCode?: 'tenant_not_found' | 'invalid_domain' | 'domain_taken' | 'vercel_error';
  error?: string;
}

// Same hostname regex used by the tenant insert schema. Apex-only:
// no leading dot, must have a TLD, ≤253 chars.
const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export async function startDomainSetup(input: StartDomainSetupInput): Promise<DomainSetupResult> {
  const domain = input.domain.trim().toLowerCase();

  if (!DOMAIN_REGEX.test(domain) || domain.length > 253) {
    return {
      success: false,
      errorCode: 'invalid_domain',
      error: `"${input.domain}" is geen geldig domein`,
    };
  }

  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) {
    return {
      success: false,
      errorCode: 'tenant_not_found',
      error: `Tenant ${input.tenantId} bestaat niet`,
    };
  }

  const existing = await tenantsRepo.findByCustomDomain(domain);
  if (existing && existing.id !== input.tenantId) {
    return {
      success: false,
      errorCode: 'domain_taken',
      error: `Domein "${domain}" is al gekoppeld aan een andere tenant`,
    };
  }

  let vercelInfo;
  try {
    vercelInfo = await getVercelDomainsClient().addDomain(domain);
  } catch (err) {
    return {
      success: false,
      errorCode: 'vercel_error',
      error: err instanceof Error ? err.message : 'Vercel afwees domein',
    };
  }

  await tenantsRepo.update(input.tenantId, { custom_domain: domain });

  console.log('[domain] domain_setup_started', {
    tenantId: input.tenantId,
    domain,
    performedByUserId: input.performedByUserId,
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    setup: {
      tenantId: input.tenantId,
      domain,
      status: vercelInfo.status,
      dnsRecords: vercelInfo.verificationRecords,
      verifiedAt: null,
      errorMessage: vercelInfo.errorMessage ?? null,
    },
  };
}

export async function verifyDomainSetup(input: VerifyDomainSetupInput): Promise<DomainSetupResult> {
  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) {
    return {
      success: false,
      errorCode: 'tenant_not_found',
      error: `Tenant ${input.tenantId} bestaat niet`,
    };
  }

  let info;
  try {
    info = await getVercelDomainsClient().verifyDomain(input.domain);
  } catch (err) {
    return {
      success: false,
      errorCode: 'vercel_error',
      error: err instanceof Error ? err.message : 'Verificatie mislukte',
    };
  }

  const status: DomainStatus = info.status;
  const verifiedAt = status === 'active' ? new Date().toISOString() : null;

  return {
    success: true,
    setup: {
      tenantId: input.tenantId,
      domain: input.domain,
      status,
      dnsRecords: info.verificationRecords,
      verifiedAt,
      errorMessage: info.errorMessage ?? null,
    },
  };
}

export async function removeDomainSetup(input: VerifyDomainSetupInput): Promise<DomainSetupResult> {
  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) {
    return {
      success: false,
      errorCode: 'tenant_not_found',
      error: `Tenant ${input.tenantId} bestaat niet`,
    };
  }

  try {
    await getVercelDomainsClient().removeDomain(input.domain);
  } catch (err) {
    return {
      success: false,
      errorCode: 'vercel_error',
      error: err instanceof Error ? err.message : 'Domain verwijderen mislukt',
    };
  }

  if (tenant.custom_domain === input.domain) {
    await tenantsRepo.update(input.tenantId, { custom_domain: null });
  }

  return { success: true };
}
