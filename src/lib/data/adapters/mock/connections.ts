import type { ProviderConnection } from '@/types/database';
import type { ConnectionsRepository } from '../../repositories/connections';
import { generateId, getTimestamp, table } from './store';

export const mockConnectionsRepo: ConnectionsRepository = {
  async listByTenant(tenantId) {
    return Array.from(table('provider_connections').values()).filter(
      (c) => c.tenant_id === tenantId
    );
  },
  async findByCategory(tenantId, category) {
    return Array.from(table('provider_connections').values()).filter(
      (c) => c.tenant_id === tenantId && c.category === category
    );
  },
  async create(data) {
    const row: ProviderConnection = {
      ...data,
      id: generateId(),
      connected_at: getTimestamp(),
      last_used_at: null,
    };
    table('provider_connections').set(row.id, row);
    return row;
  },
  async update(id, data) {
    const existing = table('provider_connections').get(id);
    if (!existing) throw new Error(`provider_connections: ${id} not found`);
    const updated: ProviderConnection = { ...existing, ...data, id };
    table('provider_connections').set(id, updated);
    return updated;
  },
  async revoke(id) {
    return this.update(id, { status: 'disconnected', encrypted_token: null });
  },
};
