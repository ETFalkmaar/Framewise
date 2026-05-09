import type { User } from '@/types/database';
import {
  parseOrThrow,
  userInsertSchema,
  userUpdateSchema,
  ValidationError,
  VALIDATION_ERROR_CODES,
} from '@/lib/validation';
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
    const parsed = parseOrThrow(userInsertSchema, data, 'Invalid user input');
    const emailClash = Array.from(table('users').values()).some(
      (u) => u.email.toLowerCase() === parsed.email.toLowerCase()
    );
    if (emailClash) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.EMAIL_NOT_UNIQUE,
        `User email "${parsed.email}" is already taken`,
        { field: 'email' }
      );
    }
    const now = getTimestamp();
    const row: User = { ...parsed, id: generateId(), created_at: now, updated_at: now };
    table('users').set(row.id, row);
    return row;
  },
  async update(id, data) {
    const existing = table('users').get(id);
    if (!existing) {
      throw new ValidationError(VALIDATION_ERROR_CODES.NOT_FOUND, `users: ${id} not found`);
    }
    const parsed = parseOrThrow(userUpdateSchema, data, 'Invalid user update');
    if (parsed.email && parsed.email !== existing.email) {
      const clash = Array.from(table('users').values()).some(
        (u) => u.id !== id && u.email.toLowerCase() === parsed.email!.toLowerCase()
      );
      if (clash) {
        throw new ValidationError(
          VALIDATION_ERROR_CODES.EMAIL_NOT_UNIQUE,
          `User email "${parsed.email}" is already taken`,
          { field: 'email' }
        );
      }
    }
    const updated: User = { ...existing, ...parsed, id, updated_at: getTimestamp() };
    table('users').set(id, updated);
    return updated;
  },
  async delete(id) {
    if (!table('users').delete(id)) {
      throw new ValidationError(VALIDATION_ERROR_CODES.NOT_FOUND, `users: ${id} not found`);
    }
  },
};
