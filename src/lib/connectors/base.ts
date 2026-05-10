import { connectionsRepo } from '@/lib/data';
import { storeToken, revokeToken } from '@/lib/vault';
import type { ProviderConnection } from '@/types/database';
import type { CountryCode, ProviderId } from '@/lib/countries';

import type { ConnectorContext, ConnectorDefinition, TestConnectionResult } from './types';

/**
 * Optional base class for connector implementations. Most connector
 * definitions are plain object literals — `BaseConnector` exists so
 * step-15+ class-based connectors can share the credential-persisting
 * helpers without re-implementing them.
 *
 * The framework itself uses the lower-level `storeCredentials` /
 * `revokeCredentials` exports below (see `flows/shared.ts`) so plain
 * literal definitions also benefit from the same logic.
 */
export abstract class BaseConnector implements ConnectorDefinition {
  abstract readonly id: ProviderId;
  abstract readonly category: ConnectorDefinition['category'];
  abstract readonly authMethod: ConnectorDefinition['authMethod'];

  developmentOnly?: boolean;
  availableIn?: CountryCode[];
  oauth?: ConnectorDefinition['oauth'];
  apiKey?: ConnectorDefinition['apiKey'];

  async testConnection(
    _credentials: Record<string, string>,
    _context: ConnectorContext
  ): Promise<TestConnectionResult> {
    return { ok: true };
  }

  protected async storeCredentials(
    context: ConnectorContext,
    credentials: Record<string, string>
  ): Promise<string> {
    return storeCredentials(this, context, credentials);
  }

  protected async revokeCredentials(
    connectionId: string,
    context: ConnectorContext
  ): Promise<void> {
    return revokeCredentials(connectionId, context);
  }
}

/**
 * Find-or-create the `provider_connections` row for `(tenantId, category,
 * provider)` and persist the supplied credentials via the vault.
 *
 * - Existing `connected` row → token is rotated.
 * - Existing `disconnected` / `error` / `expired` row → reused (the
 *   mock adapter's `create()` handles this transparently).
 * - No row at all → `connectionsRepo.create()` inserts one.
 */
export async function storeCredentials(
  connector: ConnectorDefinition,
  context: ConnectorContext,
  credentials: Record<string, string>
): Promise<string> {
  const plaintext = JSON.stringify(credentials);

  const existing: ProviderConnection | null = await connectionsRepo.findByProvider(
    context.tenantId,
    connector.id
  );

  let connectionId: string;
  if (existing) {
    if (existing.status !== 'connected') {
      // Re-enable a previously broken connection so the vault.storeToken
      // owner-check passes (it requires status to allow updates).
      await connectionsRepo.update(existing.id, { status: 'connected' });
    }
    connectionId = existing.id;
  } else {
    const created = await connectionsRepo.create({
      tenant_id: context.tenantId,
      category: connector.category as ProviderConnection['category'],
      provider: connector.id,
      status: 'connected',
      auth_method: connector.authMethod as ProviderConnection['auth_method'],
      encrypted_token: null,
      metadata: {},
      expires_at: null,
    });
    connectionId = created.id;
  }

  await storeToken(connectionId, plaintext, {
    tenantId: context.tenantId,
    userId: context.userId,
    ipAddress: context.ipAddress,
  });
  return connectionId;
}

/**
 * Wipe the encrypted token, mark the connection `disconnected`, and
 * write a `revoke` audit row. Idempotent.
 */
export async function revokeCredentials(
  connectionId: string,
  context: ConnectorContext
): Promise<void> {
  await revokeToken(connectionId, {
    tenantId: context.tenantId,
    userId: context.userId,
    ipAddress: context.ipAddress,
  });
}
