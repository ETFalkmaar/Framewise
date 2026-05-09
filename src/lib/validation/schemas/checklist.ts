import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { countrySchema } from '../helpers/country';

const planCodeSchema = z.enum(['basic', 'pro', 'enterprise']);
const actionTypeSchema = z.enum(['domain', 'connection', 'info']);

export const checklistTemplateRowSchema = z.object({
  id: uuidSchema,
  country: countrySchema,
  plan_code: planCodeSchema,
  category: z.string().min(1).max(40),
  label_nl: z.string().min(1).max(200),
  label_fr: z.string().min(1).max(200),
  label_en: z.string().min(1).max(200),
  required: z.boolean(),
  order_index: z.number().int().min(0),
  action_type: actionTypeSchema,
});

export const checklistStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'skipped']);
