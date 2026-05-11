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

const organizationTypeSchema = z.enum([
  'Organization',
  'LocalBusiness',
  'Restaurant',
  'LodgingBusiness',
]);

// Twitter handle without the leading "@". 1-15 chars of [A-Za-z0-9_]
// per Twitter's published rule.
const twitterHandleSchema = z.string().regex(/^[A-Za-z0-9_]{1,15}$/, 'Expected a Twitter handle');

const ogImageUrlSchema = z.string().url();

// Step 34: branded maintenance fields.
const maintenanceMessageSchema = z.partialRecord(localeSchema, z.string().min(1).max(500));
const maintenanceLogoUrlSchema = z.string().url();
const maintenanceContactEmailSchema = z.string().email().toLowerCase();

// Step 47: publish-request lifecycle fields. All optional on
// update; the `.strict()` schemas would otherwise reject the
// patches `requestSitePublish` etc. send.
const publishRequestStatusSchema = z.enum(['none', 'pending', 'approved', 'rejected']);
const publishApprovalNotesSchema = z.string().min(1).max(2000);

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
    og_image_url: ogImageUrlSchema.nullable(),
    organization_type: organizationTypeSchema.nullable(),
    twitter_handle: twitterHandleSchema.nullable(),
    maintenance_message_translations: maintenanceMessageSchema.nullable(),
    maintenance_logo_url: maintenanceLogoUrlSchema.nullable(),
    maintenance_contact_email: maintenanceContactEmailSchema.nullable(),
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
    og_image_url: ogImageUrlSchema.nullable().optional(),
    organization_type: organizationTypeSchema.nullable().optional(),
    twitter_handle: twitterHandleSchema.nullable().optional(),
    maintenance_message_translations: maintenanceMessageSchema.nullable().optional(),
    maintenance_logo_url: maintenanceLogoUrlSchema.nullable().optional(),
    maintenance_contact_email: maintenanceContactEmailSchema.nullable().optional(),
    // Step 47 — publish-request lifecycle.
    publish_request_status: publishRequestStatusSchema.optional(),
    publish_requested_at: isoDateTimeSchema.nullable().optional(),
    publish_requested_by_user_id: uuidSchema.nullable().optional(),
    publish_approval_notes: publishApprovalNotesSchema.nullable().optional(),
    publish_approved_at: isoDateTimeSchema.nullable().optional(),
    publish_approved_by_user_id: uuidSchema.nullable().optional(),
    publish_rejected_at: isoDateTimeSchema.nullable().optional(),
    publish_rejected_by_user_id: uuidSchema.nullable().optional(),
    // Step 49 — booking module flags.
    bookings_enabled: z.boolean().optional(),
    booking_timezone: z.string().min(1).max(64).nullable().optional(),
    // Step 55 — calendar-feed subscription token.
    calendar_feed_token: z.string().min(16).max(128).nullable().optional(),
    // Step 56 — AI agent feature flag + linked agent id.
    ai_agent_enabled: z.boolean().optional(),
    ai_agent_id: uuidSchema.nullable().optional(),
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
  og_image_url: ogImageUrlSchema.nullable(),
  organization_type: organizationTypeSchema.nullable(),
  twitter_handle: twitterHandleSchema.nullable(),
  maintenance_message_translations: maintenanceMessageSchema.nullable(),
  maintenance_logo_url: maintenanceLogoUrlSchema.nullable(),
  maintenance_contact_email: maintenanceContactEmailSchema.nullable(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});

export type TenantInsert = z.infer<typeof tenantInsertSchema>;
export type TenantUpdate = z.infer<typeof tenantUpdateSchema>;
export type TenantRow = z.infer<typeof tenantRowSchema>;
