import { z } from 'zod';

export const localeSchema = z.enum(['nl', 'fr', 'en']);

export const localesArraySchema = z.array(localeSchema).min(1);

export type LocaleSchema = z.infer<typeof localeSchema>;
