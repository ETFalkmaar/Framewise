import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { isoDateTimeSchema } from '../helpers/iso-date';

const subscriptionStatusSchema = z.enum(['active', 'paused', 'cancelled', 'trialing']);

export const subscriptionInsertSchema = z.object({
  tenant_id: uuidSchema,
  plan_id: uuidSchema,
  status: subscriptionStatusSchema,
  started_at: isoDateTimeSchema,
  current_period_start: isoDateTimeSchema,
  current_period_end: isoDateTimeSchema,
  cancel_at_period_end: z.boolean().default(false),
  stripe_subscription_id: z.string().nullable(),
});

export const subscriptionUpdateSchema = z
  .object({
    plan_id: uuidSchema.optional(),
    status: subscriptionStatusSchema.optional(),
    current_period_start: isoDateTimeSchema.optional(),
    current_period_end: isoDateTimeSchema.optional(),
    cancel_at_period_end: z.boolean().optional(),
    stripe_subscription_id: z.string().nullable().optional(),
  })
  .strict();

export type SubscriptionInsert = z.infer<typeof subscriptionInsertSchema>;
export type SubscriptionUpdate = z.infer<typeof subscriptionUpdateSchema>;
