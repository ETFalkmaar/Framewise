import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { resetStore, tenantsRepo, usersRepo } from '@/lib/data';
import { table } from '@/lib/data/adapters/mock/store';
import type { TenantUser } from '@/types/database';

import { createTenant, generateInitialPassword } from '../create-tenant';
import type { OnboardingFormData } from '../types';

const ADMIN_USER_ID = 'a0000000-0000-0000-0000-000000000001';

const BASE_INPUT: OnboardingFormData = {
  companyName: 'Acme Beach Resort',
  contactEmail: 'owner@acme-beach.example',
  contactName: 'Jan Jansen',
  preferredLocale: 'nl',
  country: 'NL',
  tenantSlug: 'acme-beach',
  customDomain: null,
  planTier: 'pro',
  vatNumber: 'NL123456789B01',
  cribNumber: '',
  legalName: 'Acme Beach B.V.',
  legalAddress: 'Damrak 1',
  legalCity: 'Amsterdam',
  legalPostalCode: '1012LP',
};

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('generateInitialPassword', () => {
  it('produces 16 chars of alphanumeric output', () => {
    const password = generateInitialPassword();
    expect(password).toHaveLength(16);
    expect(/^[A-Za-z0-9]+$/.test(password)).toBe(true);
  });

  it('produces a different password every call', () => {
    const passwords = new Set(Array.from({ length: 32 }, () => generateInitialPassword()));
    expect(passwords.size).toBe(32);
  });

  it('avoids confusable characters (O / 0, I / 1, l)', () => {
    for (let i = 0; i < 50; i++) {
      const password = generateInitialPassword();
      expect(password).not.toMatch(/[O0Il1]/);
    }
  });
});

describe('createTenant — happy path', () => {
  it('returns success with a tenantId, ownerUserId, and initialPassword', async () => {
    const result = await createTenant(BASE_INPUT, ADMIN_USER_ID);
    expect(result.success).toBe(true);
    expect(result.tenantId).toMatch(/^[0-9a-f-]+$/i);
    expect(result.ownerUserId).toMatch(/^[0-9a-f-]+$/i);
    expect(result.initialPassword).toBeDefined();
    expect(result.initialPassword?.length).toBe(16);
  });

  it('creates a tenant with status = "onboarding"', async () => {
    const result = await createTenant(BASE_INPUT, ADMIN_USER_ID);
    const tenant = await tenantsRepo.findById(result.tenantId!);
    expect(tenant?.status).toBe('onboarding');
  });

  it('creates a tenant with the correct slug, name, country, and locale', async () => {
    const result = await createTenant(BASE_INPUT, ADMIN_USER_ID);
    const tenant = await tenantsRepo.findById(result.tenantId!);
    expect(tenant?.slug).toBe('acme-beach');
    expect(tenant?.name).toBe('Acme Beach Resort');
    expect(tenant?.country).toBe('NL');
    expect(tenant?.default_locale).toBe('nl');
  });

  it('stores the VAT number on the tenant for an NL onboarding', async () => {
    const result = await createTenant(BASE_INPUT, ADMIN_USER_ID);
    const tenant = await tenantsRepo.findById(result.tenantId!);
    expect(tenant?.vat_number).toBe('NL123456789B01');
    expect(tenant?.crib_number).toBeNull();
  });

  it('stores the CRIB number on the tenant for a CW onboarding', async () => {
    const cwInput: OnboardingFormData = {
      ...BASE_INPUT,
      contactEmail: 'owner@cw.example',
      tenantSlug: 'cw-villa',
      country: 'CW',
      vatNumber: '',
      cribNumber: '0987654321',
      legalAddress: 'Caracasbaaiweg 1',
      legalCity: 'Willemstad',
      legalPostalCode: '0000',
    };
    const result = await createTenant(cwInput, ADMIN_USER_ID);
    const tenant = await tenantsRepo.findById(result.tenantId!);
    expect(tenant?.country).toBe('CW');
    expect(tenant?.crib_number).toBe('0987654321');
    expect(tenant?.vat_number).toBeNull();
  });

  it('creates an owner user with the right email + name', async () => {
    const result = await createTenant(BASE_INPUT, ADMIN_USER_ID);
    const owner = await usersRepo.findById(result.ownerUserId!);
    expect(owner?.email).toBe('owner@acme-beach.example');
    expect(owner?.name).toBe('Jan Jansen');
  });

  it('binds the owner to the tenant via tenant_users with the owner role', async () => {
    const result = await createTenant(BASE_INPUT, ADMIN_USER_ID);
    const memberships = Array.from(table('tenant_users').values() as IterableIterator<TenantUser>);
    const link = memberships.find((m) => m.tenant_id === result.tenantId);
    expect(link).toBeDefined();
    expect(link?.user_id).toBe(result.ownerUserId);
    const role = table('roles').get(link!.role_id);
    expect(role?.name).toBe('owner');
  });

  it('persists the initial password on the user record (mock adapter)', async () => {
    const result = await createTenant(BASE_INPUT, ADMIN_USER_ID);
    const owner = await usersRepo.findById(result.ownerUserId!);
    expect(owner?.password_hash).toBe(result.initialPassword);
  });

  it('selects the right subscription_plan_id for the chosen tier', async () => {
    const result = await createTenant({ ...BASE_INPUT, planTier: 'enterprise' }, ADMIN_USER_ID);
    const tenant = await tenantsRepo.findById(result.tenantId!);
    expect(tenant?.subscription_plan_id).toBeDefined();
  });

  it('respects custom domain when supplied', async () => {
    const result = await createTenant(
      { ...BASE_INPUT, customDomain: 'acmebeach.nl' },
      ADMIN_USER_ID
    );
    const tenant = await tenantsRepo.findById(result.tenantId!);
    expect(tenant?.custom_domain).toBe('acmebeach.nl');
  });
});

describe('createTenant — error paths', () => {
  it('rejects a slug already in use by another tenant', async () => {
    const result = await createTenant({ ...BASE_INPUT, tenantSlug: 'demo-villa' }, ADMIN_USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Slug.*al in gebruik/);
  });

  it('rejects a custom domain already in use', async () => {
    const result = await createTenant(
      { ...BASE_INPUT, customDomain: 'villa-bonbini.com' },
      ADMIN_USER_ID
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Custom domain.*al gekoppeld/);
  });

  it('rejects when the email is already registered with another user', async () => {
    const result = await createTenant(
      { ...BASE_INPUT, contactEmail: 'framewise@example.com' },
      ADMIN_USER_ID
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bestaat al/);
  });

  it('does not create a tenant on failure (no orphan)', async () => {
    const before = (await tenantsRepo.list()).length;
    await createTenant({ ...BASE_INPUT, tenantSlug: 'demo-villa' }, ADMIN_USER_ID);
    const after = (await tenantsRepo.list()).length;
    expect(after).toBe(before);
  });

  it('does not create an owner user on slug collision', async () => {
    const before = (await usersRepo.list()).length;
    await createTenant({ ...BASE_INPUT, tenantSlug: 'demo-villa' }, ADMIN_USER_ID);
    const after = (await usersRepo.list()).length;
    expect(after).toBe(before);
  });
});
