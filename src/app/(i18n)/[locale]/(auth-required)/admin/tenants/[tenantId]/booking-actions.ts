'use server';

import { revalidatePath } from 'next/cache';

import { requireCurrentUser } from '@/lib/auth';
import { auditLogsRepo, tenantsRepo } from '@/lib/data';
import { canEnableBookings } from '@/lib/permissions/bookings';

export type AdminBookingErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'tenant_not_found'
  | 'repo_error';

export interface AdminBookingResult {
  success: boolean;
  error?: AdminBookingErrorCode;
}

/**
 * Super-admin booking-toggle action (step 49). Flips `bookings_enabled`
 * + optionally sets `booking_timezone`. Writes a `tenant_bookings_toggled`
 * audit-log entry with the before/after for traceability.
 */
export async function toggleBookingsForTenant(input: {
  tenantId: string;
  enabled: boolean;
  timezone?: string | null;
}): Promise<AdminBookingResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'unauthenticated' };
  }
  if (!canEnableBookings(user.id)) return { success: false, error: 'forbidden' };

  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return { success: false, error: 'tenant_not_found' };

  try {
    await tenantsRepo.update(tenant.id, {
      bookings_enabled: input.enabled,
      booking_timezone: input.timezone !== undefined ? input.timezone : tenant.booking_timezone,
    });
    await auditLogsRepo.create({
      tenant_id: tenant.id,
      action: 'tenant_bookings_toggled',
      performed_by_user_id: user.id,
      metadata: {
        before: { enabled: tenant.bookings_enabled, timezone: tenant.booking_timezone },
        after: {
          enabled: input.enabled,
          timezone: input.timezone !== undefined ? input.timezone : tenant.booking_timezone,
        },
      },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }

  revalidatePath('/admin/tenants');
  revalidatePath(`/admin/tenants/${input.tenantId}`);
  revalidatePath('/account/bookings');
  return { success: true };
}
