import type { ProviderConnection } from '@/types/database';
import {
  assertProviderAvailable,
  connectionInsertSchema,
  connectionUpdateSchema,
  parseOrThrow,
  ValidationError,
  VALIDATION_ERROR_CODES,
} from '@/lib/validation';
import type { CountryCode } from '@/lib/countries';

import type { ConnectionsRepository } from '../../repositories/connections';
import { generateId, getTimestamp, table } from './store';

const VALID_TRANSITIONS: Record<ProviderConnection['status'], ProviderConnection['status'][]> = {
  connected: ['disconnected', 'error', 'expired'],
  disconnected: ['connected'],
  error: ['connected', 'disconnected'],
  expired: ['connected', 'disconnected'],
};

function assertTransition(
  from: ProviderConnection['status'],
  to: ProviderConnection['status']
): void {
  if (from === to) return;
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new ValidationError(
      VALIDATION_ERROR_CODES.STATUS_TRANSITION_INVALID,
      `Connection status transition not allowed: ${from} → ${to}`,
      { field: 'status' }
    );
  }
}

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

  async findByProvider(tenantId, providerId) {
    return (
      Array.from(table('provider_connections').values()).find(
        (c) => c.tenant_id === tenantId && c.provider === providerId
      ) ?? null
    );
  },

  async findActive(tenantId) {
    return Array.from(table('provider_connections').values()).filter(
      (c) => c.tenant_id === tenantId && c.status === 'connected'
    );
  },

  async create(data) {
    const parsed = parseOrThrow(connectionInsertSchema, {
      ...data,
      // Defaults that the type-level Omit<> doesn't enforce.
      encrypted_token: data.encrypted_token ?? null,
      metadata: data.metadata ?? {},
      expires_at: data.expires_at ?? null,
    });

    // Cross-entity rule: provider must be available in the tenant's country.
    const tenant = table('tenants').get(parsed.tenant_id);
    if (!tenant) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.NOT_FOUND,
        `Tenant ${parsed.tenant_id} not found`,
        { field: 'tenant_id' }
      );
    }
    assertProviderAvailable(parsed.provider, tenant.country as CountryCode);

    // Re-use a disconnected row for the same (tenant, category, provider) so
    // we don't accumulate ghost rows when a user reconnects.
    const existing = Array.from(table('provider_connections').values()).find(
      (c) =>
        c.tenant_id === parsed.tenant_id &&
        c.category === parsed.category &&
        c.provider === parsed.provider
    );
    if (existing) {
      if (existing.status === 'connected') {
        throw new ValidationError(
          VALIDATION_ERROR_CODES.INVALID_INPUT,
          `Provider "${parsed.provider}" is already connected for this tenant`,
          { field: 'provider' }
        );
      }
      const updated: ProviderConnection = {
        ...existing,
        status: parsed.status,
        auth_method: parsed.auth_method,
        encrypted_token: parsed.encrypted_token ?? null,
        metadata: { ...(existing.metadata ?? {}), ...(parsed.metadata ?? {}) },
        expires_at: parsed.expires_at ?? null,
        connected_at: getTimestamp(),
      };
      table('provider_connections').set(existing.id, updated);
      return updated;
    }

    const row: ProviderConnection = {
      id: generateId(),
      tenant_id: parsed.tenant_id,
      category: parsed.category,
      provider: parsed.provider,
      status: parsed.status,
      auth_method: parsed.auth_method,
      encrypted_token: parsed.encrypted_token ?? null,
      metadata: parsed.metadata ?? {},
      expires_at: parsed.expires_at ?? null,
      connected_at: getTimestamp(),
      last_used_at: null,
    };
    table('provider_connections').set(row.id, row);
    return row;
  },

  async update(id, data) {
    const existing = table('provider_connections').get(id);
    if (!existing) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.NOT_FOUND,
        `provider_connections: ${id} not found`,
        { field: 'id' }
      );
    }

    // Validate the partial payload itself (skip cross-entity check on update).
    parseOrThrow(connectionUpdateSchema, data);

    if (data.status && data.status !== existing.status) {
      assertTransition(existing.status, data.status);
    }

    const updated: ProviderConnection = { ...existing, ...data, id };
    table('provider_connections').set(id, updated);
    return updated;
  },

  async revoke(id) {
    const existing = table('provider_connections').get(id);
    if (!existing) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.NOT_FOUND,
        `provider_connections: ${id} not found`,
        { field: 'id' }
      );
    }
    if (existing.status !== 'disconnected') {
      assertTransition(existing.status, 'disconnected');
    }
    const updated: ProviderConnection = {
      ...existing,
      status: 'disconnected',
      encrypted_token: null,
      last_used_at: getTimestamp(),
    };
    table('provider_connections').set(id, updated);
    return updated;
  },

  async markExpired(id) {
    const existing = table('provider_connections').get(id);
    if (!existing) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.NOT_FOUND,
        `provider_connections: ${id} not found`,
        { field: 'id' }
      );
    }
    if (existing.status !== 'expired') {
      assertTransition(existing.status, 'expired');
    }
    const updated: ProviderConnection = {
      ...existing,
      status: 'expired',
      expires_at: getTimestamp(),
    };
    table('provider_connections').set(id, updated);
    return updated;
  },

  async markError(id, errorMessage) {
    const existing = table('provider_connections').get(id);
    if (!existing) {
      throw new ValidationError(
        VALIDATION_ERROR_CODES.NOT_FOUND,
        `provider_connections: ${id} not found`,
        { field: 'id' }
      );
    }
    if (existing.status !== 'error') {
      assertTransition(existing.status, 'error');
    }
    const updated: ProviderConnection = {
      ...existing,
      status: 'error',
      metadata: errorMessage
        ? { ...(existing.metadata ?? {}), last_error: errorMessage }
        : existing.metadata,
    };
    table('provider_connections').set(id, updated);
    return updated;
  },
};
