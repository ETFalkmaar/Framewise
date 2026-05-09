import type { User } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface UsersRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(): Promise<User[]>;
  create(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<UsersRepository>('usersRepo');
export const usersRepo = proxy;
export const setUsersRepo = set;
