'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canCustomerCancel, canCustomerReschedule } from '@/lib/bookings/can-modify';
import { generateSlotsForDate } from '@/lib/bookings/slot-generator';
import { auditLogsRepo, bookingsRepo, tenantsRepo } from '@/lib/data';
import {
  bookingCancellationEmail,
  bookingRescheduledEmail,
} from '@/lib/notifications/email-templates/bookings';
import { queueEmail } from '@/lib/notifications/email-stub';

/**
 * Customer self-service server actions (step 54, fase 14 part 6/7).
 *
 * Trust model — three layers of verification:
 *  1. Reference code (8-char `BK-YYYY-XXXX`) — hard to brute-force.
 *  2. Email match — the customer must know the address they used.
 *  3. Per-booking session cookie (`booking_verified_{ref}=true`,
 *     1h TTL, HttpOnly, SameSite=Strict) — set only after the email
 *     match succeeds. Defense-in-depth so the cancel + reschedule
 *     actions don't accept blind reference-code probing even after
 *     a customer follows a stale link.
 *
 * No login required at any point — anonymous flow throughout.
 */

const COOKIE_TTL_SECONDS = 60 * 60; // 1 hour

export type SelfServiceError =
  | 'not_found'
  | 'email_mismatch'
  | 'forbidden'
  | 'cannot_cancel'
  | 'cannot_reschedule'
  | 'too_close'
  | 'past_booking'
  | 'already_cancelled'
  | 'wrong_status'
  | 'slot_not_available'
  | 'validation_failed'
  | 'unknown_error';

export interface SelfServiceResult {
  success: boolean;
  error?: SelfServiceError;
  /** Set by `customerRescheduleBooking` so the UI can redirect to
   *  the new reference page. */
  newReference?: string;
}

function cookieName(reference: string): string {
  return `booking_verified_${reference}`;
}

async function readVerifyCookie(reference: string): Promise<boolean> {
  const store = await cookies();
  return store.get(cookieName(reference))?.value === 'true';
}

async function writeVerifyCookie(reference: string): Promise<void> {
  const store = await cookies();
  store.set(cookieName(reference), 'true', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_TTL_SECONDS,
    path: '/',
  });
}

const verifyEmailSchema = z.object({
  tenantSlug: z.string().min(1),
  reference: z.string().min(1),
  email: z.string().email(),
});

/**
 * Phase-one of the lookup flow — confirms the customer knows the
 * email tied to a reference code, then sets a short-lived cookie so
 * the subsequent cancel / reschedule calls can skip the same check
 * on every click.
 */
export async function verifyBookingEmail(input: {
  tenantSlug: string;
  reference: string;
  email: string;
}): Promise<SelfServiceResult> {
  const parsed = verifyEmailSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'validation_failed' };

  const tenant = await tenantsRepo.findBySlug(parsed.data.tenantSlug);
  if (!tenant || !tenant.bookings_enabled) return { success: false, error: 'not_found' };

  const booking = await bookingsRepo.findByReferenceCode(parsed.data.reference);
  if (!booking || booking.tenant_id !== tenant.id) {
    return { success: false, error: 'not_found' };
  }

  if (booking.customer_email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return { success: false, error: 'email_mismatch' };
  }

  await writeVerifyCookie(parsed.data.reference);
  try {
    await auditLogsRepo.create({
      tenant_id: tenant.id,
      action: 'booking_email_verified',
      performed_by_user_id: null,
      metadata: {
        bookingId: booking.id,
        reference: booking.reference_code,
      },
    });
  } catch {
    /* audit failures don't break the verify flow. */
  }
  return { success: true };
}

const cancelSchema = z.object({
  tenantSlug: z.string().min(1),
  reference: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
});

/**
 * Customer-initiated cancellation. Requires the verify cookie set
 * by `verifyBookingEmail`.
 */
export async function customerCancelBooking(input: {
  tenantSlug: string;
  reference: string;
  reason?: string | null;
}): Promise<SelfServiceResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'validation_failed' };

  const verified = await readVerifyCookie(parsed.data.reference);
  if (!verified) return { success: false, error: 'forbidden' };

  const tenant = await tenantsRepo.findBySlug(parsed.data.tenantSlug);
  if (!tenant) return { success: false, error: 'not_found' };
  const booking = await bookingsRepo.findByReferenceCode(parsed.data.reference);
  if (!booking || booking.tenant_id !== tenant.id) {
    return { success: false, error: 'not_found' };
  }

  const gate = canCustomerCancel(booking);
  if (!gate.allowed) {
    return { success: false, error: gate.reason ?? 'cannot_cancel' };
  }

  const reason = parsed.data.reason?.trim() || 'Cancelled by customer';
  let cancelled;
  try {
    cancelled = await bookingsRepo.update(booking.id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    });
    await auditLogsRepo.create({
      tenant_id: tenant.id,
      action: 'booking_cancelled_by_customer',
      performed_by_user_id: null,
      metadata: {
        bookingId: booking.id,
        reference: booking.reference_code,
        reason,
      },
    });
  } catch {
    return { success: false, error: 'unknown_error' };
  }

  // Best-effort customer email.
  if (cancelled) {
    try {
      const template = bookingCancellationEmail(cancelled, tenant);
      await queueEmail({
        to: cancelled.customer_email,
        subject: template.subject,
        body: template.body,
        tenantId: tenant.id,
        metadata: {
          bookingId: cancelled.id,
          reference: cancelled.reference_code,
          recipient: 'customer',
          event: 'booking_cancelled_by_customer',
          reason,
        },
      });
    } catch {
      /* no-op */
    }
  }

  try {
    revalidatePath(`/sites/${parsed.data.tenantSlug}/booking/${parsed.data.reference}`);
    revalidatePath(`/account/bookings`);
  } catch {
    /* outside request scope */
  }

  return { success: true };
}

const rescheduleSchema = z.object({
  tenantSlug: z.string().min(1),
  reference: z.string().min(1),
  newStartTime: z.string().min(1),
});

/**
 * Reschedule = cancel the old booking + create a new one with the
 * same customer details on the requested slot. We deliberately
 * don't move the row in-place: keeping the audit trail intact lets
 * the operator (and us, when we need to debug) trace what happened.
 */
export async function customerRescheduleBooking(input: {
  tenantSlug: string;
  reference: string;
  newStartTime: string;
}): Promise<SelfServiceResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'validation_failed' };

  const verified = await readVerifyCookie(parsed.data.reference);
  if (!verified) return { success: false, error: 'forbidden' };

  const tenant = await tenantsRepo.findBySlug(parsed.data.tenantSlug);
  if (!tenant) return { success: false, error: 'not_found' };
  const oldBooking = await bookingsRepo.findByReferenceCode(parsed.data.reference);
  if (!oldBooking || oldBooking.tenant_id !== tenant.id) {
    return { success: false, error: 'not_found' };
  }

  const gate = canCustomerReschedule(oldBooking);
  if (!gate.allowed) {
    return { success: false, error: gate.reason ?? 'cannot_reschedule' };
  }

  const newDate = parsed.data.newStartTime.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    return { success: false, error: 'validation_failed' };
  }
  const slots = await generateSlotsForDate({
    tenantId: tenant.id,
    date: newDate,
    partySize: oldBooking.party_size,
  });
  const matching = slots.find(
    (s) => s.start_time === parsed.data.newStartTime && s.capacity_remaining > 0
  );
  if (!matching) return { success: false, error: 'slot_not_available' };

  let newBooking;
  try {
    newBooking = await bookingsRepo.create({
      tenant_id: tenant.id,
      status: 'pending',
      start_date: newDate,
      end_date: newDate,
      persons: oldBooking.party_size,
      guest_name: oldBooking.customer_name,
      guest_email: oldBooking.customer_email,
      guest_phone: oldBooking.customer_phone,
      total_price_cents: 0,
      currency: 'EUR',
      payment_status: 'unpaid',
      payment_provider: null,
      payment_reference: null,
      notes: oldBooking.notes,
      booking_type: 'time_slot',
      start_time: matching.start_time,
      end_time: matching.end_time,
      party_size: oldBooking.party_size,
      customer_name: oldBooking.customer_name,
      customer_email: oldBooking.customer_email,
      customer_phone: oldBooking.customer_phone,
      internal_notes: null,
    });

    // Cancel old with linked metadata so the operator can trace the
    // reschedule chain from either side.
    await bookingsRepo.update(oldBooking.id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'rescheduled',
    });

    await auditLogsRepo.create({
      tenant_id: tenant.id,
      action: 'booking_rescheduled_by_customer',
      performed_by_user_id: null,
      metadata: {
        oldBookingId: oldBooking.id,
        oldReference: oldBooking.reference_code,
        newBookingId: newBooking.id,
        newReference: newBooking.reference_code,
        oldStart: oldBooking.start_time,
        newStart: matching.start_time,
      },
    });
  } catch {
    return { success: false, error: 'unknown_error' };
  }

  // Best-effort customer email.
  try {
    const template = bookingRescheduledEmail(oldBooking, newBooking, tenant);
    await queueEmail({
      to: newBooking.customer_email,
      subject: template.subject,
      body: template.body,
      tenantId: tenant.id,
      metadata: {
        oldReference: oldBooking.reference_code,
        newReference: newBooking.reference_code,
        recipient: 'customer',
        event: 'booking_rescheduled_by_customer',
      },
    });
  } catch {
    /* no-op */
  }

  // Set the verify cookie for the new reference too so the customer
  // arrives on the new lookup page already authenticated.
  try {
    await writeVerifyCookie(newBooking.reference_code);
  } catch {
    /* no-op */
  }

  try {
    revalidatePath(`/sites/${parsed.data.tenantSlug}/booking/${parsed.data.reference}`);
    revalidatePath(`/sites/${parsed.data.tenantSlug}/booking/${newBooking.reference_code}`);
    revalidatePath('/account/bookings');
  } catch {
    /* outside request scope */
  }

  return { success: true, newReference: newBooking.reference_code };
}
