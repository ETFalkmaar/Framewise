import type { Block } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface BlocksRepository {
  findByPageId(pageId: string): Promise<Block[]>;
  create(data: Omit<Block, 'id' | 'created_at' | 'updated_at'>): Promise<Block>;
  update(id: string, data: Partial<Block>): Promise<Block>;
  delete(id: string): Promise<void>;
  reorder(pageId: string, orderedIds: string[]): Promise<Block[]>;
}

const { proxy, set } = createRepoProxy<BlocksRepository>('blocksRepo');
export const blocksRepo = proxy;
export const setBlocksRepo = set;
