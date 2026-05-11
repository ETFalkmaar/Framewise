import type { AvailabilityRule } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface AvailabilityRulesRepository {
  listByTenant(tenantId: string): Promise<AvailabilityRule[]>;
  /** Convenience filter — only `is_active: true` rows. */
  listActive(tenantId: string): Promise<AvailabilityRule[]>;
  findById(id: string): Promise<AvailabilityRule | null>;
  create(data: Omit<AvailabilityRule, 'id' | 'created_at' | 'updated_at'>): Promise<AvailabilityRule>;
  update(id: string, data: Partial<AvailabilityRule>): Promise<AvailabilityRule>;
  delete(id: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<AvailabilityRulesRepository>('availabilityRulesRepo');
export const availabilityRulesRepo = proxy;
export const setAvailabilityRulesRepo = set;
