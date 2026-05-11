import type { Notification } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface ListNotificationsOptions {
  /** Restrict to unread only — the bell-dropdown's "ongelezen" filter. */
  unreadOnly?: boolean;
  /** Cap the result set. Defaults to 50. */
  limit?: number;
  /** Skip first N — for pagination on the full notifications page. */
  offset?: number;
}

export interface NotificationsRepository {
  /** Newest-first. */
  listByUser(userId: string, options?: ListNotificationsOptions): Promise<Notification[]>;
  countUnreadByUser(userId: string): Promise<number>;
  findById(id: string): Promise<Notification | null>;
  /**
   * Insert. The repo fills `id`, `created_at`, `is_read: false`,
   * `read_at: null` — callers only supply the user-facing fields.
   */
  create(
    data: Omit<Notification, 'id' | 'created_at' | 'is_read' | 'read_at'>
  ): Promise<Notification>;
  /** Idempotent — calling twice keeps `read_at` from the first call. */
  markAsRead(id: string): Promise<void>;
  /** Bulk-mark every unread notification for one user. Returns the count flipped. */
  markAllAsRead(userId: string): Promise<number>;
}

const { proxy, set } = createRepoProxy<NotificationsRepository>('notificationsRepo');
export const notificationsRepo = proxy;
export const setNotificationsRepo = set;
