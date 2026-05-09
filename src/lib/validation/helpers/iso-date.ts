import { z } from 'zod';

/**
 * ISO 8601 datetime string (e.g. 2026-05-09T19:00:00.000Z).
 *
 * Uses an anchored regex rather than the locale-bound `z.iso.datetime()`
 * helper so the parser behaves the same in v3 and v4 of zod.
 */
export const isoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
    'Expected ISO 8601 datetime (YYYY-MM-DDTHH:MM:SS[.sss]Z)'
  );

/** ISO 8601 date-only string (YYYY-MM-DD). */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/** A YYYY-MM-DD that lies in the future (today or later). */
export const futureDateSchema = isoDateSchema.refine(
  (d) => {
    const today = new Date().toISOString().slice(0, 10);
    return d >= today;
  },
  { message: 'Date must be today or in the future' }
);
