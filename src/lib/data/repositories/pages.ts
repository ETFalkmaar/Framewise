import type { Page } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface PagesRepository {
  findById(id: string): Promise<Page | null>;
  findBySlug(tenantId: string, slug: string): Promise<Page | null>;
  listByTenant(tenantId: string): Promise<Page[]>;
  create(data: Omit<Page, 'id' | 'created_at' | 'updated_at'>): Promise<Page>;
  update(id: string, data: Partial<Page>): Promise<Page>;
  delete(id: string): Promise<void>;
  publish(id: string): Promise<Page>;
  unpublish(id: string): Promise<Page>;
}

const { proxy, set } = createRepoProxy<PagesRepository>('pagesRepo');
export const pagesRepo = proxy;
export const setPagesRepo = set;
