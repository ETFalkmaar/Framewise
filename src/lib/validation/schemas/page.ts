import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { isoDateTimeSchema } from '../helpers/iso-date';
import { slugSchema } from '../helpers/slug';

const pageStatusSchema = z.enum(['draft', 'published', 'archived']);

export const pageInsertSchema = z.object({
  tenant_id: uuidSchema,
  slug: slugSchema,
  status: pageStatusSchema,
  parent_id: uuidSchema.nullable(),
  order_index: z.number().int().min(0),
  published_at: isoDateTimeSchema.nullable(),
});

export const pageUpdateSchema = z
  .object({
    slug: slugSchema.optional(),
    status: pageStatusSchema.optional(),
    parent_id: uuidSchema.nullable().optional(),
    order_index: z.number().int().min(0).optional(),
    published_at: isoDateTimeSchema.nullable().optional(),
  })
  .strict();

export type PageInsert = z.infer<typeof pageInsertSchema>;
export type PageUpdate = z.infer<typeof pageUpdateSchema>;
