import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { resetStore, tenantsRepo } from '@/lib/data';

import {
  MockVercelDomainsClient,
  removeDomainSetup,
  setVercelDomainsClient,
  startDomainSetup,
  verifyDomainSetup,
} from '../index';

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  resetStore();
  setVercelDomainsClient(new MockVercelDomainsClient());
});

afterEach(() => {
  setVercelDomainsClient(null);
  resetStore();
});

describe('startDomainSetup', () => {
  it('returns pending_dns + DNS records for a fresh domain', async () => {
    // Villa's seeded `custom_domain` is `villa-bonbini.com`; pick a
    // different one to avoid the "already on this tenant" branch.
    const result = await startDomainSetup({
      tenantId: VILLA_ID,
      domain: 'klant-test.nl',
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(true);
    expect(result.setup?.status).toBe('pending_dns');
    expect(result.setup?.dnsRecords.length).toBeGreaterThan(0);

    const villa = await tenantsRepo.findById(VILLA_ID);
    expect(villa?.custom_domain).toBe('klant-test.nl');
  });

  it('rejects malformed domain strings', async () => {
    const result = await startDomainSetup({
      tenantId: VILLA_ID,
      domain: 'not a domain',
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('invalid_domain');
  });

  it('rejects a domain already used by another tenant', async () => {
    // demo-restaurant seed has no custom_domain; demo-villa has
    // `villa-bonbini.com`. Try to attach it to restaurant.
    const result = await startDomainSetup({
      tenantId: RESTAURANT_ID,
      domain: 'villa-bonbini.com',
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('domain_taken');
  });

  it('allows the same tenant to re-attach its existing domain', async () => {
    const result = await startDomainSetup({
      tenantId: VILLA_ID,
      domain: 'villa-bonbini.com',
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(true);
  });

  it('returns tenant_not_found for an unknown tenant', async () => {
    const result = await startDomainSetup({
      tenantId: 'does-not-exist',
      domain: 'klant-test.nl',
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('tenant_not_found');
  });

  it('lowercases and trims the submitted domain', async () => {
    const result = await startDomainSetup({
      tenantId: VILLA_ID,
      domain: '  KLANT.NL  ',
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.setup?.domain).toBe('klant.nl');
  });
});

describe('verifyDomainSetup', () => {
  it('progresses pending_dns -> ssl_pending -> active across two calls', async () => {
    await startDomainSetup({
      tenantId: VILLA_ID,
      domain: 'klant-test.nl',
      performedByUserId: SUPER_ADMIN_ID,
    });

    const first = await verifyDomainSetup({
      tenantId: VILLA_ID,
      domain: 'klant-test.nl',
    });
    expect(first.success).toBe(true);
    expect(first.setup?.status).toBe('ssl_pending');
    expect(first.setup?.verifiedAt).toBeNull();

    const second = await verifyDomainSetup({
      tenantId: VILLA_ID,
      domain: 'klant-test.nl',
    });
    expect(second.success).toBe(true);
    expect(second.setup?.status).toBe('active');
    expect(typeof second.setup?.verifiedAt).toBe('string');
  });

  it('returns tenant_not_found for unknown tenant', async () => {
    const result = await verifyDomainSetup({
      tenantId: 'does-not-exist',
      domain: 'klant-test.nl',
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('tenant_not_found');
  });

  it('returns vercel_error when the domain was never added', async () => {
    const result = await verifyDomainSetup({
      tenantId: VILLA_ID,
      domain: 'never-added.nl',
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('vercel_error');
  });
});

describe('removeDomainSetup', () => {
  it('clears tenant.custom_domain when removing the same domain', async () => {
    await startDomainSetup({
      tenantId: VILLA_ID,
      domain: 'klant-test.nl',
      performedByUserId: SUPER_ADMIN_ID,
    });
    const result = await removeDomainSetup({
      tenantId: VILLA_ID,
      domain: 'klant-test.nl',
    });
    expect(result.success).toBe(true);
    const villa = await tenantsRepo.findById(VILLA_ID);
    expect(villa?.custom_domain).toBeNull();
  });

  it('leaves tenant.custom_domain alone when removing a different domain', async () => {
    await startDomainSetup({
      tenantId: VILLA_ID,
      domain: 'klant-test.nl',
      performedByUserId: SUPER_ADMIN_ID,
    });
    // `removeDomain` on the mock client silently ignores unknown
    // names (matches Vercel's behaviour — they 204 on missing IDs).
    // The orchestrator only clears `custom_domain` when the names
    // match, so the existing attachment stays in place.
    const result = await removeDomainSetup({
      tenantId: VILLA_ID,
      domain: 'other.nl',
    });
    expect(result.success).toBe(true);
    const villa = await tenantsRepo.findById(VILLA_ID);
    expect(villa?.custom_domain).toBe('klant-test.nl');
  });

  it('returns tenant_not_found for unknown tenant', async () => {
    const result = await removeDomainSetup({
      tenantId: 'does-not-exist',
      domain: 'klant-test.nl',
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('tenant_not_found');
  });
});
