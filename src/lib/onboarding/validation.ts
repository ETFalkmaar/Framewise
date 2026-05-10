import { z } from 'zod';

import { countrySchema, localeSchema, slugSchema } from '@/lib/validation';

const subscriptionPlanCodeSchema = z.enum(['basic', 'pro', 'enterprise']);

const customDomainSchema = z
  .string()
  .regex(
    /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
    'Verwacht een geldige hostname (bv. klant.nl)'
  )
  .max(253);

/**
 * Step 1: company name + primary contact + preferred locale.
 *
 * The contact address becomes the owner user's login; the owner
 * receives an initial password rendered once on the success page
 * (step 30). Email is lowercased to match `userInsertSchema`.
 */
export const basicInfoSchema = z.object({
  companyName: z.string().trim().min(2, 'Bedrijfsnaam is te kort').max(100),
  contactEmail: z.string().email('Ongeldig e-mailadres').toLowerCase(),
  contactName: z.string().trim().min(2, 'Naam is te kort').max(100),
  preferredLocale: localeSchema,
});

/**
 * Step 2: country gate. Drives currency, default timezone, and
 * which providers (accounting, payments, …) the tenant can connect
 * to in later steps.
 */
export const countryStepSchema = z.object({
  country: countrySchema,
});

/**
 * Step 3: tenant slug + optional custom domain + plan tier.
 *
 * `tenantSlug` reuses the project-wide `slugSchema` (lowercase,
 * digits, hyphens, no double-hyphens, ≤63 chars). `customDomain`
 * is `null` for now — set later via the domain wizard (step 33).
 */
export const tenantDetailsSchema = z.object({
  tenantSlug: slugSchema,
  customDomain: customDomainSchema.nullable(),
  planTier: subscriptionPlanCodeSchema,
});

/**
 * Step 4: tax identifiers + legal address.
 *
 * `vatNumber` is required for NL tenants, `cribNumber` for CW —
 * the cross-country refine validates this against `country` so a
 * NL tenant can't accidentally store a CRIB. Both have light
 * format checks; the strict provider-side validation (e.g. VIES
 * lookup) lands later.
 */
export const taxInfoSchema = z
  .object({
    country: countrySchema,
    vatNumber: z
      .string()
      .trim()
      .regex(/^NL\d{9}B\d{2}$/, 'BTW-nummer formaat NL123456789B01')
      .optional()
      .or(z.literal('')),
    cribNumber: z
      .string()
      .trim()
      .min(6, 'CRIB-nummer is te kort')
      .max(20, 'CRIB-nummer is te lang')
      .optional()
      .or(z.literal('')),
    legalName: z.string().trim().min(2).max(200),
    legalAddress: z.string().trim().min(5).max(200),
    legalCity: z.string().trim().min(2).max(100),
    legalPostalCode: z.string().trim().min(3).max(20),
  })
  .superRefine((data, ctx) => {
    if (data.country === 'NL') {
      if (!data.vatNumber || data.vatNumber.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['vatNumber'],
          message: 'BTW-nummer is verplicht voor NL tenants',
        });
      }
    }
    if (data.country === 'CW') {
      if (!data.cribNumber || data.cribNumber.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['cribNumber'],
          message: 'CRIB-nummer is verplicht voor CW tenants',
        });
      }
    }
  });

/**
 * Combined schema validated by the server action just before the
 * orchestrator runs. Keeping the per-step schemas separate lets
 * the wizard validate a single step without forcing the visitor to
 * fill out the next one.
 */
export const onboardingSchema = z
  .object({
    companyName: basicInfoSchema.shape.companyName,
    contactEmail: basicInfoSchema.shape.contactEmail,
    contactName: basicInfoSchema.shape.contactName,
    preferredLocale: basicInfoSchema.shape.preferredLocale,
    country: countryStepSchema.shape.country,
    tenantSlug: tenantDetailsSchema.shape.tenantSlug,
    customDomain: tenantDetailsSchema.shape.customDomain,
    planTier: tenantDetailsSchema.shape.planTier,
    vatNumber: z.string().trim().optional().or(z.literal('')),
    cribNumber: z.string().trim().optional().or(z.literal('')),
    legalName: z.string().trim().min(2).max(200),
    legalAddress: z.string().trim().min(5).max(200),
    legalCity: z.string().trim().min(2).max(100),
    legalPostalCode: z.string().trim().min(3).max(20),
  })
  .superRefine((data, ctx) => {
    if (data.country === 'NL') {
      if (!data.vatNumber || data.vatNumber.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['vatNumber'],
          message: 'BTW-nummer is verplicht voor NL tenants',
        });
      } else if (!/^NL\d{9}B\d{2}$/.test(data.vatNumber)) {
        ctx.addIssue({
          code: 'custom',
          path: ['vatNumber'],
          message: 'BTW-nummer formaat NL123456789B01',
        });
      }
    }
    if (data.country === 'CW') {
      if (!data.cribNumber || data.cribNumber.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['cribNumber'],
          message: 'CRIB-nummer is verplicht voor CW tenants',
        });
      }
    }
  });

export type BasicInfoInput = z.infer<typeof basicInfoSchema>;
export type CountryStepInput = z.infer<typeof countryStepSchema>;
export type TenantDetailsInput = z.infer<typeof tenantDetailsSchema>;
export type TaxInfoInput = z.infer<typeof taxInfoSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
