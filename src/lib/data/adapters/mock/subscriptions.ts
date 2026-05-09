import type { Subscription } from '@/types/database';
import type { SubscriptionsRepository } from '../../repositories/subscriptions';
import { generateId, getTimestamp, table } from './store';

export const mockSubscriptionsRepo: SubscriptionsRepository = {
  async findByTenant(tenantId) {
    return (
      Array.from(table('subscriptions').values()).find((s) => s.tenant_id === tenantId) ?? null
    );
  },
  async list() {
    return Array.from(table('subscriptions').values());
  },
  async create(data) {
    const row: Subscription = {
      ...data,
      id: generateId(),
      created_at: getTimestamp(),
    };
    table('subscriptions').set(row.id, row);
    return row;
  },
  async update(id, data) {
    const existing = table('subscriptions').get(id);
    if (!existing) throw new Error(`subscriptions: ${id} not found`);
    const updated: Subscription = { ...existing, ...data, id };
    table('subscriptions').set(id, updated);
    return updated;
  },
  async cancel(id, atPeriodEnd) {
    const existing = table('subscriptions').get(id);
    if (!existing) throw new Error(`subscriptions: ${id} not found`);
    const updated: Subscription = {
      ...existing,
      cancel_at_period_end: atPeriodEnd,
      status: atPeriodEnd ? existing.status : 'cancelled',
    };
    table('subscriptions').set(id, updated);
    return updated;
  },
  async listPlans() {
    return Array.from(table('subscription_plans').values());
  },
  async findPlanById(id) {
    return table('subscription_plans').get(id) ?? null;
  },
};
