import type { Block } from '@/types/database';
import type { BlocksRepository } from '../../repositories/blocks';
import { generateId, getTimestamp, table } from './store';

export const mockBlocksRepo: BlocksRepository = {
  async findByPageId(pageId) {
    return Array.from(table('blocks').values())
      .filter((b) => b.page_id === pageId)
      .sort((a, b) => a.order_index - b.order_index);
  },
  async create(data) {
    const now = getTimestamp();
    const row: Block = {
      ...data,
      id: generateId(),
      created_at: now,
      updated_at: now,
    };
    table('blocks').set(row.id, row);
    return row;
  },
  async update(id, data) {
    const existing = table('blocks').get(id);
    if (!existing) throw new Error(`blocks: ${id} not found`);
    const updated: Block = { ...existing, ...data, id, updated_at: getTimestamp() };
    table('blocks').set(id, updated);
    return updated;
  },
  async delete(id) {
    if (!table('blocks').delete(id)) throw new Error(`blocks: ${id} not found`);
  },
  async reorder(pageId, orderedIds) {
    const now = getTimestamp();
    orderedIds.forEach((id, index) => {
      const existing = table('blocks').get(id);
      if (!existing || existing.page_id !== pageId) {
        throw new Error(`blocks: ${id} not on page ${pageId}`);
      }
      table('blocks').set(id, { ...existing, order_index: index, updated_at: now });
    });
    return this.findByPageId(pageId);
  },
};
