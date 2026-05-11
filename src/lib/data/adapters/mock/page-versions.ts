import type { PageVersion } from '@/types/database';
import type { PageVersionsRepository } from '../../repositories/page-versions';
import { generateId, getTimestamp, table } from './store';

const DEFAULT_LIMIT = 50;

export const mockPageVersionsRepo: PageVersionsRepository = {
  async listByPage(pageId, options) {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    return Array.from(table('page_versions').values())
      .filter((v) => v.page_id === pageId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  },

  async countByPage(pageId) {
    let n = 0;
    for (const v of table('page_versions').values()) {
      if (v.page_id === pageId) n++;
    }
    return n;
  },

  async findById(id) {
    return table('page_versions').get(id) ?? null;
  },

  async create(data) {
    const row: PageVersion = {
      ...data,
      id: generateId(),
      created_at: getTimestamp(),
    };
    table('page_versions').set(row.id, row);
    return row;
  },
};
