import type { User } from '@/types/database';
import type { UsersRepository } from '../../repositories/users';
import { generateId, getTimestamp, table } from './store';

export const mockUsersRepo: UsersRepository = {
  async findById(id) {
    return table('users').get(id) ?? null;
  },
  async findByEmail(email) {
    return (
      Array.from(table('users').values()).find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      ) ?? null
    );
  },
  async list() {
    return Array.from(table('users').values());
  },
  async create(data) {
    const now = getTimestamp();
    const row: User = { ...data, id: generateId(), created_at: now, updated_at: now };
    table('users').set(row.id, row);
    return row;
  },
  async update(id, data) {
    const existing = table('users').get(id);
    if (!existing) throw new Error(`users: ${id} not found`);
    const updated: User = { ...existing, ...data, id, updated_at: getTimestamp() };
    table('users').set(id, updated);
    return updated;
  },
  async delete(id) {
    if (!table('users').delete(id)) throw new Error(`users: ${id} not found`);
  },
};
