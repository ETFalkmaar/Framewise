import type { Notification } from '@/types/database';
import type { NotificationsRepository } from '../../repositories/notifications';
import { generateId, getTimestamp, table } from './store';

const DEFAULT_LIMIT = 50;

export const mockNotificationsRepo: NotificationsRepository = {
  async listByUser(userId, options) {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.offset ?? 0;
    const unreadOnly = options?.unreadOnly ?? false;
    return Array.from(table('notifications').values())
      .filter((n) => n.user_id === userId)
      .filter((n) => (unreadOnly ? !n.is_read : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(offset, offset + limit);
  },

  async countUnreadByUser(userId) {
    let count = 0;
    for (const n of table('notifications').values()) {
      if (n.user_id === userId && !n.is_read) count++;
    }
    return count;
  },

  async findById(id) {
    return table('notifications').get(id) ?? null;
  },

  async create(data) {
    const row: Notification = {
      ...data,
      id: generateId(),
      created_at: getTimestamp(),
      is_read: false,
      read_at: null,
    };
    table('notifications').set(row.id, row);
    return row;
  },

  async markAsRead(id) {
    const existing = table('notifications').get(id);
    if (!existing) return;
    if (existing.is_read) return; // Idempotent — keep original read_at.
    table('notifications').set(id, {
      ...existing,
      is_read: true,
      read_at: getTimestamp(),
    });
  },

  async markAllAsRead(userId) {
    let flipped = 0;
    const now = getTimestamp();
    for (const [id, n] of table('notifications').entries()) {
      if (n.user_id === userId && !n.is_read) {
        table('notifications').set(id, { ...n, is_read: true, read_at: now });
        flipped++;
      }
    }
    return flipped;
  },
};
