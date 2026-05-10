import { randomBytes, randomUUID } from 'node:crypto';

import { subscriptionsRepo, tenantCountrySettingsRepo, tenantsRepo, usersRepo } from '@/lib/data';
import { table } from '@/lib/data/adapters/mock/store';
import { ensureChecklistForTenant } from '@/lib/checklist';
import { getCountryConfig } from '@/lib/countries';
import type {
  Country,
  Role,
  SubscriptionPlanCode,
  Tenant,
  TenantUser,
  User,
} from '@/types/database';

import type { OnboardingFormData, OnboardingResult } from './types';

/**
 * Atomic-ish tenant onboarding orchestrator (step 30).
 *
 * Provisions a brand-new customer in a single call:
 *  1. Validate slug + (optional) custom domain are free.
 *  2. Resolve the chosen plan code to a `subscription_plan_id`.
 *  3. `tenants.create()` — status starts at `'onboarding'` so the
 *     middleware shows the maintenance shell, not the half-built
 *     site.
 *  4. `users.create()` for the primary contact, password generated
 *     here and returned exactly once on the response.
 *  5. Insert the `tenant_users` row binding the user to the tenant
 *     with the `owner` role.
 *  6. Upsert `tenant_country_settings` from the country config.
 *  7. Seed the per-country/per-plan setup checklist.
 *
 * On failure mid-way through we best-effort rollback in reverse
 * order — the mock adapter has no transactions, but Supabase
 * (step 119) gets a real one.
 */
export async function createTenant(
  input: OnboardingFormData,
  createdByUserId: string
): Promise<OnboardingResult> {
  // 1. Slug uniqueness — `tenantsRepo.create()` would also catch
  //    this with `SLUG_NOT_UNIQUE` but checking up front lets us
  //    return a friendlier error from the wizard.
  const existingBySlug = await tenantsRepo.findBySlug(input.tenantSlug);
  if (existingBySlug) {
    return { success: false, error: `Slug "${input.tenantSlug}" is al in gebruik` };
  }

  if (input.customDomain) {
    const existingByDomain = await tenantsRepo.findByCustomDomain(input.customDomain);
    if (existingByDomain) {
      return {
        success: false,
        error: `Custom domain "${input.customDomain}" is al gekoppeld aan een andere tenant`,
      };
    }
  }

  // 2. Plan code → plan id.
  const plan = await findPlanByCode(input.planTier);
  if (!plan) {
    return { success: false, error: `Onbekend plan "${input.planTier}"` };
  }

  // 3. Email uniqueness — the same person could already have an
  //    account from a previous tenant; in that case onboarding
  //    fails until we add "attach existing user to new tenant"
  //    later. For the MVP we require fresh emails.
  const existingByEmail = await usersRepo.findByEmail(input.contactEmail);
  if (existingByEmail) {
    return {
      success: false,
      error: `Een gebruiker met e-mail "${input.contactEmail}" bestaat al`,
    };
  }

  const countryConfig = getCountryConfig(input.country);
  if (!countryConfig) {
    return { success: false, error: `Onbekend land "${input.country}"` };
  }

  // 4. Tenant.
  let tenant: Tenant;
  try {
    tenant = await tenantsRepo.create({
      slug: input.tenantSlug,
      name: input.companyName,
      country: input.country,
      vat_number: emptyToNull(input.vatNumber),
      crib_number: emptyToNull(input.cribNumber),
      subscription_plan_id: plan.id,
      status: 'onboarding',
      custom_domain: input.customDomain,
      default_locale: input.preferredLocale,
      enabled_locales: dedupedLocales(input.preferredLocale, countryConfig.availableLocales),
      og_image_url: null,
      organization_type: null,
      twitter_handle: null,
    });
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Tenant aanmaken mislukt') };
  }

  // 5. Owner user.
  const initialPassword = generateInitialPassword();
  let owner: User;
  try {
    owner = await usersRepo.create({
      email: input.contactEmail,
      name: input.contactName,
      avatar_url: null,
      password_hash: initialPassword,
      last_login_at: null,
    });
  } catch (err) {
    await rollbackTenant(tenant.id);
    return { success: false, error: errorMessage(err, 'Owner-account aanmaken mislukt') };
  }

  // 6. Tenant ↔ user link with `owner` role.
  const ownerRole = findRoleByName('owner');
  if (!ownerRole) {
    await rollbackUser(owner.id);
    await rollbackTenant(tenant.id);
    return { success: false, error: '`owner` rol ontbreekt in de roles tabel (seed issue)' };
  }
  const tenantUser: TenantUser = {
    id: randomUUID(),
    tenant_id: tenant.id,
    user_id: owner.id,
    role_id: ownerRole.id,
    invited_at: new Date().toISOString(),
    joined_at: new Date().toISOString(),
  };
  table('tenant_users').set(tenantUser.id, tenantUser);

  // 7. Country settings.
  try {
    await tenantCountrySettingsRepo.upsert({
      tenant_id: tenant.id,
      country: input.country,
      currency: countryConfig.defaultCurrency,
      timezone: countryConfig.timezone,
      locale_default: input.preferredLocale,
      legal_entity_name: input.legalName,
      address: {
        street: input.legalAddress,
        city: input.legalCity,
        postal_code: input.legalPostalCode,
        country: input.country,
      },
    });
  } catch (err) {
    table('tenant_users').delete(tenantUser.id);
    await rollbackUser(owner.id);
    await rollbackTenant(tenant.id);
    return { success: false, error: errorMessage(err, 'Country settings opslaan mislukt') };
  }

  // 8. Checklist seed — non-fatal if empty (e.g. plan with no
  //    matching templates).
  try {
    await ensureChecklistForTenant(tenant.id);
  } catch {
    // Swallow — onboarding is still successful.
  }

  // 9. Light audit trail. Real persistent log lands with the wider
  //    audit framework in step 88.
  console.log('[onboarding] tenant_created', {
    tenantId: tenant.id,
    ownerUserId: owner.id,
    createdByUserId,
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    tenantId: tenant.id,
    ownerUserId: owner.id,
    contactEmail: owner.email,
    initialPassword,
  };
}

/**
 * 16-character mixed-case alphanumeric password — enough entropy
 * for an initial hand-off, the visitor must change it after first
 * login (enforced once we add the "change password on first
 * login" gate, step 56).
 */
export function generateInitialPassword(): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  // 24 random bytes mapped into the charset; take the first 16.
  const bytes = randomBytes(24);
  let out = '';
  for (let i = 0; i < bytes.length && out.length < 16; i++) {
    out += charset[bytes[i]! % charset.length];
  }
  return out;
}

async function findPlanByCode(code: SubscriptionPlanCode) {
  const plans = await subscriptionsRepo.listPlans();
  return plans.find((p) => p.code === code) ?? null;
}

function findRoleByName(name: string): Role | null {
  for (const role of table('roles').values() as IterableIterator<Role>) {
    if (role.name === name) return role;
  }
  return null;
}

function dedupedLocales(primary: string, available: readonly string[]): Array<'nl' | 'fr' | 'en'> {
  const set = new Set<string>([primary, ...available]);
  return Array.from(set).filter(
    (l): l is 'nl' | 'fr' | 'en' => l === 'nl' || l === 'fr' || l === 'en'
  );
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  return value.trim().length > 0 ? value.trim() : null;
}

async function rollbackTenant(id: string): Promise<void> {
  try {
    await tenantsRepo.delete(id);
  } catch {
    /* best-effort */
  }
}

async function rollbackUser(id: string): Promise<void> {
  try {
    await usersRepo.delete(id);
  } catch {
    /* best-effort */
  }
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}

// Use `Country` to keep the import statement non-vacuous.
export type _Country = Country;
