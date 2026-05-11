'use server';

import { revalidatePath } from 'next/cache';

import { isUserSuperAdmin, requireCurrentUser } from '@/lib/auth';
import { notificationsRepo } from '@/lib/data';

export interface NotificationActionResult {
  success: boolean;
  error?: 'unauthenticated' | 'forbidden' | 'not_found';
}

/**
 * Server actions for the notification bell / page (step 48).
 * Both gates: authenticated + super-admin (in-app notifications
 * currently flow only to super-admins for publish-request events
 * + tenant owners on approval/rejection — but for now the page
 * + bell are super-admin only; customers see their notifications
 * inline on /account via PublishStatusBanner / GoLiveCelebration).
 *
 * On success we revalidatePath so the header + page re-render
 * with the new is_read state without a full client refresh.
 */
export async function markNotificationAsReadAction(input: {
  id: string;
}): Promise<NotificationActionResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'unauthenticated' };
  }

  const notif = await notificationsRepo.findById(input.id);
  if (!notif) return { success: false, error: 'not_found' };
  // Only the owning user (or super-admin) may flip the flag.
  if (notif.user_id !== user.id && !isUserSuperAdmin(user.id)) {
    return { success: false, error: 'forbidden' };
  }

  await notificationsRepo.markAsRead(input.id);
  revalidatePath('/admin');
  revalidatePath('/admin/notifications');
  revalidatePath('/account');
  return { success: true };
}

export async function markAllNotificationsAsReadAction(): Promise<NotificationActionResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'unauthenticated' };
  }
  await notificationsRepo.markAllAsRead(user.id);
  revalidatePath('/admin');
  revalidatePath('/admin/notifications');
  revalidatePath('/account');
  return { success: true };
}
