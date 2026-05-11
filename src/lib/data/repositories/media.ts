import type { Media } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface ListMediaOptions {
  /** When `true`, return soft-deleted rows too. Default `false`. */
  includeDeleted?: boolean;
}

export interface MediaRepository {
  findById(id: string): Promise<Media | null>;
  listByTenant(tenantId: string, options?: ListMediaOptions): Promise<Media[]>;
  create(data: Omit<Media, 'id' | 'created_at'>): Promise<Media>;
  /** Hard delete — retained for tests / cleanup. */
  delete(id: string): Promise<void>;
  /**
   * Soft delete (step 42). Sets `deleted_at` on the row but
   * keeps it in the table so the customer's existing image
   * blocks don't suddenly point at missing assets.
   */
  softDelete(id: string): Promise<Media>;
}

const { proxy, set } = createRepoProxy<MediaRepository>('mediaRepo');
export const mediaRepo = proxy;
export const setMediaRepo = set;
