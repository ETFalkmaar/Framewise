import type { Media } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface MediaRepository {
  findById(id: string): Promise<Media | null>;
  listByTenant(tenantId: string): Promise<Media[]>;
  create(data: Omit<Media, 'id' | 'created_at'>): Promise<Media>;
  delete(id: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<MediaRepository>('mediaRepo');
export const mediaRepo = proxy;
export const setMediaRepo = set;
