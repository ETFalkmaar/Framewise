'use server';

import { revalidatePath } from 'next/cache';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import { auditLogsRepo, bookingsRepo, tenantsRepo } from '@/lib/data';
import { canManageBookings } from '@/lib/permissions/bookings';
import {
  bookingCancellationEmail,
  bookingConfirmedEmail,
} from '@/lib/notifications/email-templates/bookings';
import { queueEmail } from '@/lib/notifications/email-stub';

export type BookingActionErrorCode =
  | 'unauthenticated'
  | 'no_active_tenant'
  | 'tenant_not_found'
  | 'booking_not_found'
  | 'tenant_mismatch'
  | 'forbidden'
  | 'repo_error';

export interface BookingActionResult {
  success: boolean;
  error?: BookingActionErrorCode;
}

async function authenticatedTenantBookingContext(bookingId: string) {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { error: 'unauthenticated' as const };
  }
  const tenant = await getActiveTenantForUser();
  if (!tenant) return { error: 'no_active_tenant' as const };
  const fresh = await tenantsRepo.findById(tenant.id);
  if (!fresh) return { error: 'tenant_not_found' as const };
  const booking = await bookingsRepo.findById(bookingId);
  if (!booking) return { error: 'booking_not_found' as const };
  if (booking.tenant_id !== fresh.id) return { error: 'tenant_mismatch' as const };
  const allowed = await canManageBookings(user.id, fresh);
  if (!allowed) return { error: 'forbidden' as const };
  return { user, tenant: fresh, booking };
}

/**
 * Booking actions (step 49, fase 14 part 1/7). All four follow the
 * same shape: auth → resolve tenant → resolve booking → tenant-match
 * check → `canManageBookings` gate → mutate → audit-log → revalidate.
 * Failures roll back nothing because the audit-log write only happens
 * after the bookingsRepo mutation succeeds.
 */
export async function confirmBookingAction(input: {
  bookingId: string;
}): Promise<BookingActionResult> {
  const ctx = await authenticatedTenantBookingContext(input.bookingId);
  if ('error' in ctx) return { success: false, error: ctx.error };
  let confirmed;
  try {
    confirmed = await bookingsRepo.confirm(input.bookingId);
    await auditLogsRepo.create({
      tenant_id: ctx.tenant.id,
      action: 'booking_confirmed',
      performed_by_user_id: ctx.user.id,
      metadata: { bookingId: input.bookingId, referenceCode: ctx.booking.reference_code },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }
  // Step 52 — best-effort customer notification.
  if (confirmed) {
    try {
      const template = bookingConfirmedEmail(confirmed, ctx.tenant);
      await queueEmail({
        to: confirmed.customer_email,
        subject: template.subject,
        body: template.body,
        tenantId: ctx.tenant.id,
        metadata: {
          bookingId: input.bookingId,
          reference: confirmed.reference_code,
          recipient: 'customer',
          event: 'booking_confirmed',
        },
      });
    } catch {
      /* email is best-effort; confirmation already persisted. */
    }
  }
  revalidatePath('/account/bookings');
  revalidatePath('/account');
  return { success: true };
}

export async function cancelBookingAction(input: {
  bookingId: string;
  reason?: string;
}): Promise<BookingActionResult> {
  const ctx = await authenticatedTenantBookingContext(input.bookingId);
  if ('error' in ctx) return { success: false, error: ctx.error };
  const reason = input.reason?.trim() || null;
  let cancelled;
  try {
    cancelled = await bookingsRepo.update(input.bookingId, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    });
    await auditLogsRepo.create({
      tenant_id: ctx.tenant.id,
      action: 'booking_cancelled',
      performed_by_user_id: ctx.user.id,
      metadata: {
        bookingId: input.bookingId,
        referenceCode: ctx.booking.reference_code,
        reason,
      },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }
  // Step 52 — best-effort customer notification with the cancellation
  // reason if one was provided.
  if (cancelled) {
    try {
      const template = bookingCancellationEmail(cancelled, ctx.tenant);
      await queueEmail({
        to: cancelled.customer_email,
        subject: template.subject,
        body: template.body,
        tenantId: ctx.tenant.id,
        metadata: {
          bookingId: input.bookingId,
          reference: cancelled.reference_code,
          recipient: 'customer',
          event: 'booking_cancelled',
          reason,
        },
      });
    } catch {
      /* email is best-effort; cancellation already persisted. */
    }
  }
  revalidatePath('/account/bookings');
  revalidatePath('/account');
  return { success: true };
}

export async function markNoShowAction(input: { bookingId: string }): Promise<BookingActionResult> {
  const ctx = await authenticatedTenantBookingContext(input.bookingId);
  if ('error' in ctx) return { success: false, error: ctx.error };
  try {
    await bookingsRepo.update(input.bookingId, {
      status: 'no_show',
      no_show_at: new Date().toISOString(),
    });
    await auditLogsRepo.create({
      tenant_id: ctx.tenant.id,
      action: 'booking_no_show',
      performed_by_user_id: ctx.user.id,
      metadata: { bookingId: input.bookingId, referenceCode: ctx.booking.reference_code },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }
  revalidatePath('/account/bookings');
  return { success: true };
}

export async function updateInternalNotesAction(input: {
  bookingId: string;
  notes: string;
}): Promise<BookingActionResult> {
  const ctx = await authenticatedTenantBookingContext(input.bookingId);
  if ('error' in ctx) return { success: false, error: ctx.error };
  const trimmed = input.notes.trim();
  try {
    await bookingsRepo.update(input.bookingId, {
      internal_notes: trimmed.length > 0 ? trimmed : null,
    });
    await auditLogsRepo.create({
      tenant_id: ctx.tenant.id,
      action: 'booking_notes_updated',
      performed_by_user_id: ctx.user.id,
      metadata: { bookingId: input.bookingId, length: trimmed.length },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }
  revalidatePath('/account/bookings');
  return { success: true };
}
