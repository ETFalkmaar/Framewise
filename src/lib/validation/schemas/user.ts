import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { isoDateTimeSchema } from '../helpers/iso-date';

export const userInsertSchema = z.object({
  email: z.string().email('Invalid email').toLowerCase(),
  name: z.string().min(1, 'Name is required').max(200),
  avatar_url: z.string().url().nullable(),
  last_login_at: isoDateTimeSchema.nullable(),
});

export const userUpdateSchema = z
  .object({
    email: z.string().email().toLowerCase().optional(),
    name: z.string().min(1).max(200).optional(),
    avatar_url: z.string().url().nullable().optional(),
    last_login_at: isoDateTimeSchema.nullable().optional(),
  })
  .strict();

export const userRowSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string().min(1).max(200),
  avatar_url: z.string().url().nullable(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
  last_login_at: isoDateTimeSchema.nullable(),
});

export type UserInsert = z.infer<typeof userInsertSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type UserRow = z.infer<typeof userRowSchema>;
