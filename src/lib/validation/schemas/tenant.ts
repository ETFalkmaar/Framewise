import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { countrySchema } from '../helpers/country';
import { isoDateTimeSchema } from '../helpers/iso-date';
import { localeSchema, localesArraySchema } from '../helpers/locale';
import { slugSchema } from '../helpers/slug';

const tenantStatusSchema = z.enum(['onboarding', 'live', 'paused', 'cancelled']);

const customDomainSchema = z
  .string()
  .regex(
    /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
    'Expected a valid hostname (e.g. demo.example.com)'
  )
  .max(253);

export const tenantInsertSchema = z
  .object({
    slug: slugSchema,
    name: z.string().min(2, 'Name must be at least 2 characters').max(120),
    country: countrySchema,
    vat_number: z.string().nullable(),
    crib_number: z.string().nullable(),
    subscription_plan_id: uuidSchema,
    status: tenantStatusSchema,
    custom_domain: customDomainSchema.nullable(),
    default_locale: localeSchema,
    enabled_locales: localesArraySchema,
  })
  .refine((data) => data.enabled_locales.includes(data.default_locale), {
    message: 'enabled_locales must include the default_locale',
    path: ['enabled_locales'],
  });

export const tenantUpdateSchema = z
  .object({
    slug: slugSchema.optional(),
    name: z.string().min(2).max(120).optional(),
    country: countrySchema.optional(),
    vat_number: z.string().nullable().optional(),
    crib_number: z.string().nullable().optional(),
    subscription_plan_id: uuidSchema.optional(),
    status: tenantStatusSchema.optional(),
    custom_domain: customDomainSchema.nullable().optional(),
    default_locale: localeSchema.optional(),
    enabled_locales: localesArraySchema.optional(),
  })
  .strict();

export const tenantRowSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string().min(2).max(120),
  country: countrySchema,
  vat_number: z.string().nullable(),
  crib_number: z.string().nullable(),
  subscription_plan_id: uuidSchema,
  status: tenantStatusSchema,
  custom_domain: customDomainSchema.nullable(),
  default_locale: localeSchema,
  enabled_locales: localesArraySchema,
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});

export type TenantInsert = z.infer<typeof tenantInsertSchema>;
export type TenantUpdate = z.infer<typeof tenantUpdateSchema>;
export type TenantRow = z.infer<typeof tenantRowSchema>;
