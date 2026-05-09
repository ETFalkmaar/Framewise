import type { Subscription, SubscriptionPlan } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface SubscriptionsRepository {
  findByTenant(tenantId: string): Promise<Subscription | null>;
  list(): Promise<Subscription[]>;
  create(data: Omit<Subscription, 'id' | 'created_at'>): Promise<Subscription>;
  update(id: string, data: Partial<Subscription>): Promise<Subscription>;
  cancel(id: string, atPeriodEnd: boolean): Promise<Subscription>;
  listPlans(): Promise<SubscriptionPlan[]>;
  findPlanById(id: string): Promise<SubscriptionPlan | null>;
}

const { proxy, set } = createRepoProxy<SubscriptionsRepository>('subscriptionsRepo');
export const subscriptionsRepo = proxy;
export const setSubscriptionsRepo = set;
