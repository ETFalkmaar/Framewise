import type { TenantCountrySettings } from '@/types/database';
import type { TenantCountrySettingsUpsert } from '@/lib/validation';
import { createRepoProxy } from './_proxy';

/**
 * Per-tenant country-scoped settings (currency, timezone, locale, legal
 * entity, postal address). One row per tenant, keyed by `tenant_id`.
 *
 * `upsert()` runs `tenantCountrySettingsUpsertSchema` and additionally
 * checks that `country` matches the tenant's country and that
 * `locale_default` is in the country config's `availableLocales`.
 */
export interface TenantCountrySettingsRepository {
  findByTenant(tenantId: string): Promise<TenantCountrySettings | null>;
  list(): Promise<TenantCountrySettings[]>;
  upsert(data: TenantCountrySettingsUpsert): Promise<TenantCountrySettings>;
  delete(tenantId: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<TenantCountrySettingsRepository>(
  'tenantCountrySettingsRepo'
);
export const tenantCountrySettingsRepo = proxy;
export const setTenantCountrySettingsRepo = set;
