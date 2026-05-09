import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { isoDateTimeSchema } from '../helpers/iso-date';

export const supportHoursLogInsertSchema = z.object({
  tenant_id: uuidSchema,
  subscription_id: uuidSchema,
  minutes_used: z.number().int().min(0).max(480, 'Single log entry cannot exceed 8 hours'),
  description: z.string().min(5, 'Description must be at least 5 characters').max(2000),
  logged_by_user_id: uuidSchema,
  period_start: isoDateTimeSchema,
  period_end: isoDateTimeSchema,
});

export type SupportHoursLogInsert = z.infer<typeof supportHoursLogInsertSchema>;
