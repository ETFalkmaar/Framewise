import type { Block } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface BlocksRepository {
  findByPageId(pageId: string): Promise<Block[]>;
  /**
   * Direct id lookup (step 46). Used by `saveBlockContentFor` to
   * fetch the current version before deciding whether a save
   * conflicts. Step 119 keeps this on the Supabase adapter; the
   * mock simply scans the in-memory store.
   */
  findById(id: string): Promise<Block | null>;
  create(data: Omit<Block, 'id' | 'created_at' | 'updated_at' | 'version'>): Promise<Block>;
  update(id: string, data: Partial<Block>): Promise<Block>;
  delete(id: string): Promise<void>;
  reorder(pageId: string, orderedIds: string[]): Promise<Block[]>;
}

const { proxy, set } = createRepoProxy<BlocksRepository>('blocksRepo');
export const blocksRepo = proxy;
export const setBlocksRepo = set;
