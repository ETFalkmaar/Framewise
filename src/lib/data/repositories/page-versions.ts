import type { PageVersion } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface ListPageVersionsOptions {
  /** Newest-first cap. Default 50. */
  limit?: number;
}

export interface PageVersionsRepository {
  listByPage(pageId: string, options?: ListPageVersionsOptions): Promise<PageVersion[]>;
  countByPage(pageId: string): Promise<number>;
  findById(id: string): Promise<PageVersion | null>;
  create(data: Omit<PageVersion, 'id' | 'created_at'>): Promise<PageVersion>;
}

const { proxy, set } = createRepoProxy<PageVersionsRepository>('pageVersionsRepo');
export const pageVersionsRepo = proxy;
export const setPageVersionsRepo = set;
