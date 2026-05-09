import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';

export const connectionCategorySchema = z.enum([
  'accounting',
  'payments',
  'phone',
  'crm',
  'newsletter',
]);

export const connectionStatusSchema = z.enum(['connected', 'disconnected', 'error', 'expired']);

export const connectionAuthMethodSchema = z.enum(['oauth', 'api_key']);

export const connectionInsertSchema = z.object({
  tenant_id: uuidSchema,
  category: connectionCategorySchema,
  provider: z.string().min(1).max(80),
  status: connectionStatusSchema.default('connected'),
  auth_method: connectionAuthMethodSchema,
  encrypted_token: z.string().max(8192).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  expires_at: z.string().nullable().optional(),
});

export const connectionUpdateSchema = connectionInsertSchema.partial();

export const connectionRowSchema = connectionInsertSchema
  .extend({
    id: uuidSchema,
    encrypted_token: z.string().max(8192).nullable(),
    metadata: z.record(z.string(), z.unknown()),
    connected_at: z.string(),
    last_used_at: z.string().nullable(),
    expires_at: z.string().nullable(),
  })
  .strict();

export type ConnectionInsert = z.infer<typeof connectionInsertSchema>;
export type ConnectionUpdate = z.infer<typeof connectionUpdateSchema>;
export type ConnectionRow = z.infer<typeof connectionRowSchema>;
