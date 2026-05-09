import { z } from 'zod';

export const countrySchema = z.enum(['NL', 'CW']);

/** NL VAT format: NL000099998B01 */
export const vatNumberSchema = z
  .string()
  .regex(/^NL\d{9}B\d{2}$/, 'Invalid Dutch VAT number (expected NL\\d{9}B\\d{2})');

/** Curaçao CRIB number: digits and dashes only. */
export const cribNumberSchema = z
  .string()
  .regex(/^[\d-]+$/, 'CRIB number may only contain digits and dashes')
  .min(4)
  .max(32);

export type CountrySchema = z.infer<typeof countrySchema>;
