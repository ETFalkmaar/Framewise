import type { Page } from '@/types/database';
import type { PagesRepository } from '../../repositories/pages';
import { generateId, getTimestamp, table } from './store';

export const mockPagesRepo: PagesRepository = {
  async findById(id) {
    return table('pages').get(id) ?? null;
  },
  async findBySlug(tenantId, slug) {
    return (
      Array.from(table('pages').values()).find(
        (p) => p.tenant_id === tenantId && p.slug === slug
      ) ?? null
    );
  },
  async listByTenant(tenantId) {
    return Array.from(table('pages').values())
      .filter((p) => p.tenant_id === tenantId)
      .sort((a, b) => a.order_index - b.order_index);
  },
  async create(data) {
    const now = getTimestamp();
    const row: Page = {
      ...data,
      id: generateId(),
      created_at: now,
      updated_at: now,
    };
    table('pages').set(row.id, row);
    return row;
  },
  async update(id, data) {
    const existing = table('pages').get(id);
    if (!existing) throw new Error(`pages: ${id} not found`);
    const updated: Page = { ...existing, ...data, id, updated_at: getTimestamp() };
    table('pages').set(id, updated);
    return updated;
  },
  async delete(id) {
    if (!table('pages').delete(id)) throw new Error(`pages: ${id} not found`);
  },
  async publish(id) {
    const now = getTimestamp();
    return this.update(id, { status: 'published', published_at: now });
  },
  async unpublish(id) {
    return this.update(id, { status: 'draft' });
  },
};
