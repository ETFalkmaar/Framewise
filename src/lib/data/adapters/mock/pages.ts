import type { Page } from '@/types/database';
import {
  pageInsertSchema,
  pageUpdateSchema,
  parseOrThrow,
  ValidationError,
  VALIDATION_ERROR_CODES,
} from '@/lib/validation';
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
    const parsed = parseOrThrow(pageInsertSchema, data, 'Invalid page input');
    const slugClash = Array.from(table('pages').values()).some(
      (p) => p.tenant_id === parsed.tenant_id && p.slug === parsed.slug
    );
    if (slugClash) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.SLUG_NOT_UNIQUE,
        `Page slug "${parsed.slug}" already exists for this tenant`,
        { field: 'slug' }
      );
    }
    const now = getTimestamp();
    const row: Page = {
      ...parsed,
      id: generateId(),
      created_at: now,
      updated_at: now,
    };
    table('pages').set(row.id, row);
    return row;
  },
  async update(id, data) {
    const existing = table('pages').get(id);
    if (!existing) {
      throw new ValidationError(VALIDATION_ERROR_CODES.NOT_FOUND, `pages: ${id} not found`);
    }
    const parsed = parseOrThrow(pageUpdateSchema, data, 'Invalid page update');
    if (parsed.slug && parsed.slug !== existing.slug) {
      const clash = Array.from(table('pages').values()).some(
        (p) => p.id !== id && p.tenant_id === existing.tenant_id && p.slug === parsed.slug
      );
      if (clash) {
        throw new ValidationError(
          VALIDATION_ERROR_CODES.SLUG_NOT_UNIQUE,
          `Page slug "${parsed.slug}" already exists for this tenant`,
          { field: 'slug' }
        );
      }
    }
    const updated: Page = {
      ...existing,
      ...parsed,
      id,
      updated_at: getTimestamp(),
    };
    table('pages').set(id, updated);
    return updated;
  },
  async delete(id) {
    if (!table('pages').delete(id)) {
      throw new ValidationError(VALIDATION_ERROR_CODES.NOT_FOUND, `pages: ${id} not found`);
    }
  },
  async publish(id) {
    return this.update(id, { status: 'published', published_at: getTimestamp() });
  },
  async unpublish(id) {
    return this.update(id, { status: 'draft' });
  },
};
