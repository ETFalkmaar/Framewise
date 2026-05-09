import type { Tenant } from '@/types/database';
import {
  parseOrThrow,
  tenantInsertSchema,
  tenantUpdateSchema,
  ValidationError,
  VALIDATION_ERROR_CODES,
  assertTransition,
} from '@/lib/validation';
import type { TenantsRepository } from '../../repositories/tenants';
import { generateId, getTimestamp, table } from './store';

export const mockTenantsRepo: TenantsRepository = {
  async findById(id) {
    return table('tenants').get(id) ?? null;
  },
  async findBySlug(slug) {
    return Array.from(table('tenants').values()).find((t) => t.slug === slug) ?? null;
  },
  async findByCustomDomain(domain) {
    return Array.from(table('tenants').values()).find((t) => t.custom_domain === domain) ?? null;
  },
  async list() {
    return Array.from(table('tenants').values());
  },
  async create(data) {
    const parsed = parseOrThrow(tenantInsertSchema, data, 'Invalid tenant input');
    const slugClash = Array.from(table('tenants').values()).some((t) => t.slug === parsed.slug);
    if (slugClash) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.SLUG_NOT_UNIQUE,
        `Tenant slug "${parsed.slug}" is already taken`,
        { field: 'slug' }
      );
    }
    const now = getTimestamp();
    const row: Tenant = { ...parsed, id: generateId(), created_at: now, updated_at: now };
    table('tenants').set(row.id, row);
    return row;
  },
  async update(id, data) {
    const existing = table('tenants').get(id);
    if (!existing) {
      throw new ValidationError(VALIDATION_ERROR_CODES.NOT_FOUND, `tenants: ${id} not found`);
    }
    const parsed = parseOrThrow(tenantUpdateSchema, data, 'Invalid tenant update');
    if (parsed.status && parsed.status !== existing.status) {
      assertTransition(existing.status, parsed.status);
    }
    if (parsed.slug && parsed.slug !== existing.slug) {
      const clash = Array.from(table('tenants').values()).some(
        (t) => t.id !== id && t.slug === parsed.slug
      );
      if (clash) {
        throw new ValidationError(
          VALIDATION_ERROR_CODES.SLUG_NOT_UNIQUE,
          `Tenant slug "${parsed.slug}" is already taken`,
          { field: 'slug' }
        );
      }
    }
    const updated: Tenant = { ...existing, ...parsed, id, updated_at: getTimestamp() };
    table('tenants').set(id, updated);
    return updated;
  },
  async delete(id) {
    if (!table('tenants').delete(id)) {
      throw new ValidationError(VALIDATION_ERROR_CODES.NOT_FOUND, `tenants: ${id} not found`);
    }
  },
};
