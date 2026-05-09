import type { Media } from '@/types/database';
import type { MediaRepository } from '../../repositories/media';
import { generateId, getTimestamp, table } from './store';

export const mockMediaRepo: MediaRepository = {
  async findById(id) {
    return table('media').get(id) ?? null;
  },
  async listByTenant(tenantId) {
    return Array.from(table('media').values()).filter((m) => m.tenant_id === tenantId);
  },
  async create(data) {
    const row: Media = { ...data, id: generateId(), created_at: getTimestamp() };
    table('media').set(row.id, row);
    return row;
  },
  async delete(id) {
    if (!table('media').delete(id)) throw new Error(`media: ${id} not found`);
  },
};
