'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { findTenantOwnerUserId } from '@/lib/auth/find-tenant-owner';
import { generateSlotsForDate, type BookingSlot } from '@/lib/bookings/slot-generator';
import { auditLogsRepo, bookingsRepo, tenantsRepo, usersRepo } from '@/lib/data';
import {
  bookingCustomerConfirmationEmail,
  bookingOwnerNotificationEmail,
} from '@/lib/notifications/email-templates/bookings';
import { queueEmail } from '@/lib/notifications/email-stub';

/**
 * Public booking flow server actions (step 51, fase 14 part 3/7).
 *
 * Anonymous flow:
 *  1. Visitor lands on `/sites/<slug>/boek`.
 *  2. Picks a date → `fetchPublicSlots` returns the bookable times.
 *  3. Picks a slot + party size + contact info → `createPublicBooking`
 *     creates a booking with `status: 'pending'` and emits an audit
 *     entry. Step 52 wires the customer + owner email; for now the
 *     reference code is returned to the form for the confirmation
 *     screen.
 *
 * Race-condition guard: every create call re-runs the slot generator
 * to verify capacity is still > 0 for the requested start_time.
 * Bookings created seconds before in another tab will have eaten
 * the capacity by the time the generator runs, so the visitor sees
 * a graceful `slot_no_longer_available` error.
 */

const createBookingSchema = z.object({
  tenantSlug: z.string().min(1),
  customer_name: z.string().min(2).max(100),
  customer_email: z.string().email(),
  customer_phone: z.string().optional().nullable(),
  party_size: z.number().int().min(1).max(20),
  start_time: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
  honeypot: z.string().optional().nullable(),
});

export type CreatePublicBookingError =
  | 'validation_failed'
  | 'tenant_not_available'
  | 'slot_no_longer_available'
  | 'spam_detected'
  | 'unknown_error';

export interface CreatePublicBookingResult {
  success: boolean;
  bookingReference?: string;
  error?: CreatePublicBookingError;
}

export interface CreatePublicBookingInput {
  tenantSlug: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  party_size: number;
  start_time: string;
  notes?: string | null;
  honeypot?: string | null;
}

/**
 * Create a `pending` booking on behalf of an anonymous visitor.
 * Returns a typed result rather than throwing so the form can
 * render a friendly error message in the visitor's locale.
 */
export async function createPublicBooking(
  input: CreatePublicBookingInput
): Promise<CreatePublicBookingResult> {
  // Spam protection — the form has a hidden honeypot input that
  // legitimate visitors leave empty. Bots tend to fill every field.
  if (input.honeypot && input.honeypot.trim() !== '') {
    return { success: false, error: 'spam_detected' };
  }

  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'validation_failed' };
  }
  const data = parsed.data;

  const tenant = await tenantsRepo.findBySlug(data.tenantSlug);
  if (!tenant || !tenant.bookings_enabled) {
    return { success: false, error: 'tenant_not_available' };
  }

  // The slot generator uses YYYY-MM-DD, not full ISO. Derive the
  // calendar date from the requested start time.
  const startDate = data.start_time.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { success: false, error: 'validation_failed' };
  }

  const slots = await generateSlotsForDate({
    tenantId: tenant.id,
    date: startDate,
    partySize: data.party_size,
  });
  const matching = slots.find(
    (s: BookingSlot) => s.start_time === data.start_time && s.capacity_remaining > 0
  );
  if (!matching) {
    return { success: false, error: 'slot_no_longer_available' };
  }

  try {
    const booking = await bookingsRepo.create({
      tenant_id: tenant.id,
      status: 'pending',
      // Legacy nights fields — derived from the time-slot day so the
      // calendar / day-detail views keep working. The mock adapter
      // skips the per-night conflict check when booking_type='time_slot'.
      start_date: startDate,
      end_date: startDate,
      persons: data.party_size,
      guest_name: data.customer_name,
      guest_email: data.customer_email,
      guest_phone: data.customer_phone ?? null,
      total_price_cents: 0,
      currency: 'EUR',
      payment_status: 'unpaid',
      payment_provider: null,
      payment_reference: null,
      notes: data.notes ?? null,
      // Time-slot model — the new shape the slot generator drives.
      booking_type: 'time_slot',
      start_time: matching.start_time,
      end_time: matching.end_time,
      party_size: data.party_size,
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone ?? null,
      internal_notes: null,
    });

    await auditLogsRepo.create({
      tenant_id: tenant.id,
      action: 'booking_created',
      performed_by_user_id: null,
      metadata: {
        bookingId: booking.id,
        reference: booking.reference_code,
        customer_email: data.customer_email,
        party_size: data.party_size,
        start_time: matching.start_time,
        source: 'public_form',
      },
    });

    // Step 52 — fire-and-forget booking emails. Two recipients:
    //   1. the customer (confirmation that we received the request)
    //   2. the tenant owner (so they can confirm in their dashboard)
    // Both wrapped in try/catch — email queueing is best-effort and
    // must never break the booking creation flow.
    try {
      const customerTemplate = bookingCustomerConfirmationEmail(booking, tenant);
      await queueEmail({
        to: data.customer_email,
        subject: customerTemplate.subject,
        body: customerTemplate.body,
        tenantId: tenant.id,
        metadata: {
          bookingId: booking.id,
          reference: booking.reference_code,
          recipient: 'customer',
          event: 'booking_created',
        },
      });

      const ownerId = await findTenantOwnerUserId(tenant.id);
      if (ownerId) {
        const owner = await usersRepo.findById(ownerId);
        if (owner) {
          const ownerTemplate = bookingOwnerNotificationEmail(booking, tenant);
          await queueEmail({
            to: owner.email,
            subject: ownerTemplate.subject,
            body: ownerTemplate.body,
            tenantId: tenant.id,
            metadata: {
              bookingId: booking.id,
              reference: booking.reference_code,
              recipient: 'owner',
              event: 'booking_created',
            },
          });
        }
      }
    } catch {
      /* email queueing is best-effort; booking still succeeds. */
    }

    // ISR refresh — guarded so vitest runs (no Next.js request scope)
    // don't trip the static-generation-store invariant.
    try {
      revalidatePath(`/account/bookings`);
      revalidatePath(`/account/bookings/${startDate}`);
      revalidatePath(`/sites/${data.tenantSlug}/boek`);
    } catch {
      /* no-op — running outside a Next.js request scope. */
    }

    return {
      success: true,
      bookingReference: booking.reference_code,
    };
  } catch {
    return { success: false, error: 'unknown_error' };
  }
}

/**
 * Fetch the bookable slots for a specific date — feeds the form's
 * step-2 time-picker. Wrapped as a server action so the client
 * component doesn't need a separate API route.
 */
export async function fetchPublicSlots(input: {
  tenantSlug: string;
  date: string;
  partySize: number;
}): Promise<BookingSlot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return [];
  const tenant = await tenantsRepo.findBySlug(input.tenantSlug);
  if (!tenant || !tenant.bookings_enabled) return [];
  return generateSlotsForDate({
    tenantId: tenant.id,
    date: input.date,
    partySize: input.partySize,
  });
}
