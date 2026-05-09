import { z } from 'zod';

/**
 * URL-friendly slug: lower-case, digits, single hyphens between segments.
 * Must start and end with an alphanumeric character.
 */
export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(80, 'Slug may not exceed 80 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lower-case alphanumeric with single hyphens');

/** Convert any input to a slug — useful for "auto-generate from name" flows. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
