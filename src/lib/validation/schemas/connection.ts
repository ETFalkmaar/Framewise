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
  status: connectionStatusSchema,
  auth_method: connectionAuthMethodSchema,
  encrypted_token: z.string().max(8192).nullable(),
  metadata: z.record(z.string(), z.unknown()),
  expires_at: z.string().nullable(),
});

export type ConnectionInsert = z.infer<typeof connectionInsertSchema>;
