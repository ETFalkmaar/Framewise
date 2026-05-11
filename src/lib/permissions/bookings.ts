import { isUserSuperAdmin } from '@/lib/auth';
import { canEditPages, canManageTenant } from '@/lib/auth/permissions';
import type { Tenant } from '@/types/database';

/**
 * Booking-module permission gates (step 49, fase 14 part 1/7).
 *
 * Three concentric levels:
 *
 *  - `canViewBookings` — read the calendar + day detail.
 *    Requires editor-level membership AND the tenant's
 *    `bookings_enabled` flag. Super-admin bypasses the flag check
 *    (debugging / support visibility).
 *
 *  - `canManageBookings` — confirm, cancel, mark no-show, edit
 *    internal notes. Tenant owners only (editors can read but not
 *    mutate). Super-admin bypasses.
 *
 *  - `canEnableBookings` — toggle the per-tenant feature flag.
 *    Super-admin only — the customer can't switch on a feature
 *    they're not paying for.
 */
export async function canViewBookings(userId: string, tenant: Tenant): Promise<boolean> {
  if (isUserSuperAdmin(userId)) return true;
  if (!tenant.bookings_enabled) return false;
  return canEditPages(userId, tenant.id);
}

export async function canManageBookings(userId: string, tenant: Tenant): Promise<boolean> {
  if (isUserSuperAdmin(userId)) return true;
  if (!tenant.bookings_enabled) return false;
  return canManageTenant(userId, tenant.id);
}

export function canEnableBookings(userId: string): boolean {
  return isUserSuperAdmin(userId);
}
