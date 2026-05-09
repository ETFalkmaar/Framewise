import { z } from 'zod';

/**
 * UUID validator that accepts any RFC 4122-shaped UUID (v1, v4, v7, etc.).
 *
 * `z.uuid()` / `z.string().uuid()` in zod 4 became stricter about version
 * digits — our seed data uses sequential identifiers like
 * `11111111-1111-1111-1111-111111111111` for readability, which fail v4
 * validation. We accept anything that matches the canonical 8-4-4-4-12
 * hex layout.
 */
export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Expected a UUID (8-4-4-4-12 hex digits)'
  );
