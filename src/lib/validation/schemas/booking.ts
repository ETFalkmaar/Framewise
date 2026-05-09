import { z } from 'zod';
import { uuidSchema } from '../helpers/uuid';
import { isoDateSchema } from '../helpers/iso-date';

const bookingStatusSchema = z.enum(['pending', 'confirmed', 'cancelled', 'completed']);
const paymentStatusSchema = z.enum(['unpaid', 'partial', 'paid', 'refunded']);

const phoneSchema = z.string().regex(/^\+?[0-9 ()-]{6,20}$/, 'Invalid phone number');

export const bookingInsertSchema = z
  .object({
    tenant_id: uuidSchema,
    status: bookingStatusSchema,
    start_date: isoDateSchema,
    end_date: isoDateSchema,
    persons: z.number().int().min(1, 'At least 1 person').max(100),
    guest_name: z.string().min(1).max(200),
    guest_email: z.string().email(),
    guest_phone: phoneSchema.nullable(),
    total_price_cents: z.number().int().min(0),
    currency: z.enum(['EUR', 'USD', 'ANG']),
    payment_status: paymentStatusSchema,
    payment_provider: z.string().nullable(),
    payment_reference: z.string().nullable(),
    notes: z.string().max(2000).nullable(),
  })
  .refine((data) => data.start_date <= data.end_date, {
    message: 'start_date must be on or before end_date',
    path: ['end_date'],
  });

export const bookingUpdateSchema = z
  .object({
    status: bookingStatusSchema.optional(),
    start_date: isoDateSchema.optional(),
    end_date: isoDateSchema.optional(),
    persons: z.number().int().min(1).max(100).optional(),
    guest_name: z.string().min(1).max(200).optional(),
    guest_email: z.string().email().optional(),
    guest_phone: phoneSchema.nullable().optional(),
    total_price_cents: z.number().int().min(0).optional(),
    currency: z.enum(['EUR', 'USD', 'ANG']).optional(),
    payment_status: paymentStatusSchema.optional(),
    payment_provider: z.string().nullable().optional(),
    payment_reference: z.string().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict();

export type BookingInsert = z.infer<typeof bookingInsertSchema>;
export type BookingUpdate = z.infer<typeof bookingUpdateSchema>;
