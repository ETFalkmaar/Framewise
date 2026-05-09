import type { TenantCountrySettings } from '@/types/database';
import {
  parseOrThrow,
  tenantCountrySettingsUpsertSchema,
  ValidationError,
  VALIDATION_ERROR_CODES,
} from '@/lib/validation';
import { getCountryConfig } from '@/lib/countries';

import type { TenantCountrySettingsRepository } from '../../repositories/tenant-country-settings';
import { generateId, getTimestamp, table } from './store';

export const mockTenantCountrySettingsRepo: TenantCountrySettingsRepository = {
  async findByTenant(tenantId) {
    return (
      Array.from(table('tenant_country_settings').values()).find(
        (row) => row.tenant_id === tenantId
      ) ?? null
    );
  },

  async list() {
    return Array.from(table('tenant_country_settings').values());
  },

  async upsert(data) {
    const parsed = parseOrThrow(tenantCountrySettingsUpsertSchema, data);

    // Cross-field rule: locale_default must be supported by the country.
    const country = getCountryConfig(parsed.country);
    if (!country) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.INVALID_INPUT,
        `Country "${parsed.country}" is not supported`,
        { field: 'country' }
      );
    }
    if (!country.availableLocales.includes(parsed.locale_default)) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.INVALID_INPUT,
        `Locale "${parsed.locale_default}" is not available in country "${parsed.country}"`,
        { field: 'locale_default' }
      );
    }
    if (!country.supportedCurrencies.includes(parsed.currency)) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.INVALID_INPUT,
        `Currency "${parsed.currency}" is not supported in country "${parsed.country}"`,
        { field: 'currency' }
      );
    }

    const existing = Array.from(table('tenant_country_settings').values()).find(
      (row) => row.tenant_id === parsed.tenant_id
    );

    if (existing) {
      const updated: TenantCountrySettings = {
        ...existing,
        ...parsed,
        id: existing.id,
        updated_at: getTimestamp(),
      };
      table('tenant_country_settings').set(existing.id, updated);
      return updated;
    }

    const created: TenantCountrySettings = {
      ...parsed,
      id: generateId(),
      updated_at: getTimestamp(),
    };
    table('tenant_country_settings').set(created.id, created);
    return created;
  },

  async delete(tenantId) {
    const row = Array.from(table('tenant_country_settings').values()).find(
      (r) => r.tenant_id === tenantId
    );
    if (row) table('tenant_country_settings').delete(row.id);
  },
};
