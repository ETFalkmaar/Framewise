import type { AvailabilityRule } from '@/types/database';
import type { AvailabilityRulesRepository } from '../../repositories/availability-rules';
import { generateId, getTimestamp, table } from './store';

export const mockAvailabilityRulesRepo: AvailabilityRulesRepository = {
  async listByTenant(tenantId) {
    return Array.from(table('availability_rules').values())
      .filter((r) => r.tenant_id === tenantId)
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return a.start_time.localeCompare(b.start_time);
      });
  },

  async listActive(tenantId) {
    return (await this.listByTenant(tenantId)).filter((r) => r.is_active);
  },

  async findById(id) {
    return table('availability_rules').get(id) ?? null;
  },

  async create(data) {
    const now = getTimestamp();
    const row: AvailabilityRule = {
      ...data,
      id: generateId(),
      created_at: now,
      updated_at: now,
    };
    table('availability_rules').set(row.id, row);
    return row;
  },

  async update(id, data) {
    const existing = table('availability_rules').get(id);
    if (!existing) throw new Error(`availability_rules: ${id} not found`);
    const updated: AvailabilityRule = {
      ...existing,
      ...data,
      id,
      updated_at: getTimestamp(),
    };
    table('availability_rules').set(id, updated);
    return updated;
  },

  async delete(id) {
    if (!table('availability_rules').delete(id)) {
      throw new Error(`availability_rules: ${id} not found`);
    }
  },
};
