import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { isoDateTimeSchema } from '../helpers/iso-date';
import { localeSchema } from '../helpers/locale';
import { slugSchema } from '../helpers/slug';

const pageStatusSchema = z.enum(['draft', 'published', 'archived']);

// Locale-keyed string map. Partial: callers may set only the
// locales they have translations for; missing keys are allowed
// because the renderer falls back via `getTranslatedString`.
const localeStringMapSchema = z.partialRecord(localeSchema, z.string());

/**
 * Per-page SEO override payload (JSONB on the `pages` row). Step 26.
 * All keys optional — omitted keys fall back to tenant defaults and
 * block-derived metadata in `buildPageMetadata`.
 */
export const pageSeoMetaSchema = z
  .object({
    title_translations: localeStringMapSchema.optional(),
    description_translations: localeStringMapSchema.optional(),
    og_image_url: z.string().url().nullable().optional(),
    canonical_path: z
      .string()
      .regex(/^\/[^\s]*$/, 'canonical_path must start with "/"')
      .nullable()
      .optional(),
    noindex: z.boolean().optional(),
  })
  .strict();

export const pageInsertSchema = z.object({
  tenant_id: uuidSchema,
  slug: slugSchema,
  status: pageStatusSchema,
  parent_id: uuidSchema.nullable(),
  order_index: z.number().int().min(0),
  seo_meta: pageSeoMetaSchema.nullable(),
  published_at: isoDateTimeSchema.nullable(),
});

export const pageUpdateSchema = z
  .object({
    slug: slugSchema.optional(),
    status: pageStatusSchema.optional(),
    parent_id: uuidSchema.nullable().optional(),
    order_index: z.number().int().min(0).optional(),
    seo_meta: pageSeoMetaSchema.nullable().optional(),
    published_at: isoDateTimeSchema.nullable().optional(),
  })
  .strict();

export type PageInsert = z.infer<typeof pageInsertSchema>;
export type PageUpdate = z.infer<typeof pageUpdateSchema>;
export type PageSeoMeta = z.infer<typeof pageSeoMetaSchema>;
