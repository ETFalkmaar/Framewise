import type { ConnectionCategory, ProviderConnection } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface ConnectionsRepository {
  listByTenant(tenantId: string): Promise<ProviderConnection[]>;
  findByCategory(tenantId: string, category: ConnectionCategory): Promise<ProviderConnection[]>;
  findByProvider(tenantId: string, providerId: string): Promise<ProviderConnection | null>;
  findActive(tenantId: string): Promise<ProviderConnection[]>;
  create(
    data: Omit<ProviderConnection, 'id' | 'connected_at' | 'last_used_at'>
  ): Promise<ProviderConnection>;
  update(id: string, data: Partial<ProviderConnection>): Promise<ProviderConnection>;
  revoke(id: string): Promise<ProviderConnection>;
  markExpired(id: string): Promise<ProviderConnection>;
  markError(id: string, errorMessage?: string): Promise<ProviderConnection>;
}

const { proxy, set } = createRepoProxy<ConnectionsRepository>('connectionsRepo');
export const connectionsRepo = proxy;
export const setConnectionsRepo = set;
