import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { countrySchema } from '../helpers/country';
import { localeSchema } from '../helpers/locale';

export const currencySchema = z.enum(['EUR', 'USD', 'ANG']);

/** Basic IANA-style timezone check: must contain a slash. */
export const ianaTimezoneSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/\//, 'Timezone must look like an IANA zone (e.g. Europe/Amsterdam)');

export const postalAddressSchema = z
  .object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(120),
    postal_code: z.string().min(2).max(20),
    country: countrySchema,
  })
  .passthrough();

export const tenantCountrySettingsUpsertSchema = z.object({
  tenant_id: uuidSchema,
  country: countrySchema,
  currency: currencySchema,
  timezone: ianaTimezoneSchema,
  locale_default: localeSchema,
  legal_entity_name: z.string().min(2).max(200),
  address: postalAddressSchema,
});

export const tenantCountrySettingsRowSchema = tenantCountrySettingsUpsertSchema.extend({
  id: uuidSchema,
  updated_at: z.string(),
});

export type TenantCountrySettingsUpsert = z.infer<typeof tenantCountrySettingsUpsertSchema>;
export type TenantCountrySettingsRow = z.infer<typeof tenantCountrySettingsRowSchema>;
