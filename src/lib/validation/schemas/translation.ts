import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { localeSchema } from '../helpers/locale';

export const translationNamespaceSchema = z.enum(['block', 'page_meta', 'global']);

export const translationUpsertSchema = z.object({
  tenant_id: uuidSchema,
  namespace: translationNamespaceSchema,
  reference_id: uuidSchema,
  locale: localeSchema,
  content: z.record(z.string(), z.unknown()),
});

export type TranslationUpsert = z.infer<typeof translationUpsertSchema>;
