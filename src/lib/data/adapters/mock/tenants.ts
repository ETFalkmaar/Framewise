import type { Tenant } from '@/types/database';
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
    const now = getTimestamp();
    const row: Tenant = { ...data, id: generateId(), created_at: now, updated_at: now };
    table('tenants').set(row.id, row);
    return row;
  },
  async update(id, data) {
    const existing = table('tenants').get(id);
    if (!existing) throw new Error(`tenants: ${id} not found`);
    const updated: Tenant = { ...existing, ...data, id, updated_at: getTimestamp() };
    table('tenants').set(id, updated);
    return updated;
  },
  async delete(id) {
    if (!table('tenants').delete(id)) {
      throw new Error(`tenants: ${id} not found`);
    }
  },
};
