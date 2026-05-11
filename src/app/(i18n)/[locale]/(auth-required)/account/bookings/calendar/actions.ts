'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import { auditLogsRepo, tenantsRepo } from '@/lib/data';
import { canManageBookings } from '@/lib/permissions/bookings';

/**
 * Calendar feed token management (step 55, fase 14 finale).
 *
 * Three operations:
 *  - `generateCalendarFeedToken` — first-time enablement.
 *  - `rotateCalendarFeedToken` — invalidates existing subscriptions,
 *    issues a fresh token.
 *  - `revokeCalendarFeedToken` — turns the feed off entirely.
 *
 * All gated on `canManageBookings` so only the tenant owner (or
 * super-admin) can touch the feed config.
 */

export type CalendarTokenError =
  | 'unauthenticated'
  | 'no_active_tenant'
  | 'forbidden'
  | 'unknown_error';

export interface CalendarTokenResult {
  success: boolean;
  token?: string;
  error?: CalendarTokenError;
}

async function ctx() {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { error: 'unauthenticated' as const };
  }
  const tenant = await getActiveTenantForUser();
  if (!tenant) return { error: 'no_active_tenant' as const };
  const allowed = await canManageBookings(user.id, tenant);
  if (!allowed) return { error: 'forbidden' as const };
  return { user, tenant };
}

function newToken(): string {
  // 32 hex chars = 128 bits of entropy — plenty for a feed URL
  // someone embeds in their calendar client.
  return randomBytes(16).toString('hex');
}

export async function generateCalendarFeedToken(): Promise<CalendarTokenResult> {
  const c = await ctx();
  if ('error' in c) return { success: false, error: c.error };
  try {
    const token = newToken();
    await tenantsRepo.update(c.tenant.id, { calendar_feed_token: token });
    await auditLogsRepo.create({
      tenant_id: c.tenant.id,
      action: 'calendar_feed_token_generated',
      performed_by_user_id: c.user.id,
      metadata: { tokenPrefix: token.slice(0, 4) },
    });
    try {
      revalidatePath('/account/bookings/calendar');
    } catch {
      /* outside request scope */
    }
    return { success: true, token };
  } catch {
    return { success: false, error: 'unknown_error' };
  }
}

export async function rotateCalendarFeedToken(): Promise<CalendarTokenResult> {
  const c = await ctx();
  if ('error' in c) return { success: false, error: c.error };
  try {
    const token = newToken();
    await tenantsRepo.update(c.tenant.id, { calendar_feed_token: token });
    await auditLogsRepo.create({
      tenant_id: c.tenant.id,
      action: 'calendar_feed_token_rotated',
      performed_by_user_id: c.user.id,
      metadata: { tokenPrefix: token.slice(0, 4) },
    });
    try {
      revalidatePath('/account/bookings/calendar');
    } catch {
      /* no-op */
    }
    return { success: true, token };
  } catch {
    return { success: false, error: 'unknown_error' };
  }
}

export async function revokeCalendarFeedToken(): Promise<CalendarTokenResult> {
  const c = await ctx();
  if ('error' in c) return { success: false, error: c.error };
  try {
    await tenantsRepo.update(c.tenant.id, { calendar_feed_token: null });
    await auditLogsRepo.create({
      tenant_id: c.tenant.id,
      action: 'calendar_feed_token_revoked',
      performed_by_user_id: c.user.id,
      metadata: {},
    });
    try {
      revalidatePath('/account/bookings/calendar');
    } catch {
      /* no-op */
    }
    return { success: true };
  } catch {
    return { success: false, error: 'unknown_error' };
  }
}
