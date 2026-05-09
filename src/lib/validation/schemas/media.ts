import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { localeSchema } from '../helpers/locale';

const MAX_BYTES = 50 * 1024 * 1024;

export const mediaInsertSchema = z.object({
  tenant_id: uuidSchema,
  file_name: z.string().min(1).max(255),
  mime_type: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/, 'Invalid MIME type'),
  size_bytes: z.number().int().min(1).max(MAX_BYTES),
  storage_path: z.string().min(1).max(1024),
  public_url: z.string().url().max(2048),
  alt_text: z.record(localeSchema, z.string().max(400)),
  width: z.number().int().min(0).nullable(),
  height: z.number().int().min(0).nullable(),
  uploaded_by_user_id: uuidSchema,
});

export type MediaInsert = z.infer<typeof mediaInsertSchema>;
