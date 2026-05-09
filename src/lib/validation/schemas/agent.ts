import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { isoDateTimeSchema } from '../helpers/iso-date';
import { localeSchema } from '../helpers/locale';

export const agentMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string().min(1).max(20000),
  timestamp: isoDateTimeSchema,
  tool_name: z.string().max(80).optional(),
  tool_args: z.record(z.string(), z.unknown()).optional(),
  tool_result: z.unknown().optional(),
});

export const agentConversationInsertSchema = z.object({
  tenant_id: uuidSchema,
  session_id: z.string().min(1).max(80),
  lead_captured: z.boolean(),
  lead_email: z.string().email().nullable(),
  lead_phone: z.string().max(40).nullable(),
  summary: z.string().max(2000).nullable(),
  language: localeSchema,
});

export const agentKnowledgeUpsertSchema = z.object({
  tenant_id: uuidSchema,
  source_type: z.enum(['page', 'document', 'manual']),
  source_reference: z.string().max(2048).nullable(),
  content: z
    .string()
    .min(10, 'Knowledge content must be at least 10 characters')
    .max(50000, 'Knowledge content may not exceed 50000 characters'),
  embedding_dimensions: z.number().int().min(1).max(4096),
  embedding: z.array(z.number()).max(4096),
  metadata: z.record(z.string(), z.unknown()),
});

export type AgentConversationInsert = z.infer<typeof agentConversationInsertSchema>;
export type AgentKnowledgeUpsert = z.infer<typeof agentKnowledgeUpsertSchema>;
