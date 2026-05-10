import { connectionsRepo } from '@/lib/data';
import type { ProviderConnection } from '@/types/database';

import { logAccess } from './audit';
import { decryptIfWrapped, encrypt } from './crypto';
import {
  AccessDeniedError,
  EncryptionError,
  TokenNotFoundError,
  VAULT_ERROR_CODES,
} from './errors';

/**
 * Caller context for every vault operation. Matches what the audit
 * log records — keep these names stable so a Supabase migration can
 * map them to PostgREST headers / `request.jwt.claim` at the SQL
 * boundary.
 */
export interface VaultActor {
  tenantId: string;
  userId?: string | null;
  ipAddress?: string | null;
}

/**
 * Owner-check + log-and-throw on failure. Returns the connection row
 * after verifying that the actor's tenant matches.
 */
async function loadOwnedConnection(
  connectionId: string,
  actor: VaultActor,
  action: 'read' | 'write' | 'refresh' | 'revoke'
): Promise<ProviderConnection> {
  const conns = await connectionsRepo.listByTenant(actor.tenantId);
  const conn = conns.find((c) => c.id === connectionId);
  if (!conn) {
    await logAccess({
      tenantId: actor.tenantId,
      connectionId,
      action,
      success: false,
      userId: actor.userId,
      ipAddress: actor.ipAddress,
    });
    throw new AccessDeniedError(connectionId, actor.tenantId);
  }
  return conn;
}

/**
 * Encrypt + persist a token on a `provider_connections` row.
 * Equivalent to the OAuth-callback / API-key form-submit path.
 *
 * Audits a `write` entry on success, also when encryption itself fails.
 */
export async function storeToken(
  connectionId: string,
  plaintext: string,
  actor: VaultActor
): Promise<ProviderConnection> {
  const conn = await loadOwnedConnection(connectionId, actor, 'write');

  let ciphertext: string;
  try {
    ciphertext = encrypt(plaintext);
  } catch (err) {
    await logAccess({
      tenantId: actor.tenantId,
      connectionId,
      action: 'write',
      success: false,
      userId: actor.userId,
      ipAddress: actor.ipAddress,
    });
    throw err;
  }

  const updated = await connectionsRepo.update(conn.id, {
    encrypted_token: ciphertext,
  });
  await logAccess({
    tenantId: actor.tenantId,
    connectionId,
    action: 'write',
    success: true,
    userId: actor.userId,
    ipAddress: actor.ipAddress,
  });
  return updated;
}

/**
 * Decrypt and return the token plaintext.
 *
 * - Records a `read` audit row on every call (success or failure).
 * - Throws `AccessDeniedError` if the connection isn't owned by the
 *   actor's tenant.
 * - Throws `TokenNotFoundError` when the column is null.
 * - Production rejects plain-string tokens (`KEY_INVALID`); development
 *   transparently passes them through so existing seeds still work.
 */
export async function getToken(connectionId: string, actor: VaultActor): Promise<string> {
  const conn = await loadOwnedConnection(connectionId, actor, 'read');

  const stored = conn.encrypted_token;
  if (stored === null || stored.length === 0) {
    await logAccess({
      tenantId: actor.tenantId,
      connectionId,
      action: 'read',
      success: false,
      userId: actor.userId,
      ipAddress: actor.ipAddress,
    });
    throw new TokenNotFoundError(connectionId);
  }

  try {
    const { plaintext, wasEncrypted } = decryptIfWrapped(stored);
    if (!wasEncrypted && process.env.NODE_ENV === 'production') {
      throw new EncryptionError(
        VAULT_ERROR_CODES.KEY_INVALID,
        `Connection ${connectionId} stores a plain-text token; refusing to read in production.`
      );
    }
    await logAccess({
      tenantId: actor.tenantId,
      connectionId,
      action: 'read',
      success: true,
      userId: actor.userId,
      ipAddress: actor.ipAddress,
    });
    return plaintext;
  } catch (err) {
    await logAccess({
      tenantId: actor.tenantId,
      connectionId,
      action: 'read',
      success: false,
      userId: actor.userId,
      ipAddress: actor.ipAddress,
    });
    throw err;
  }
}

/**
 * Replace an existing token with a new plaintext. Audits as `refresh`.
 *
 * Behaves identically to `storeToken` from a write perspective; the
 * action label tracks intent (token rotation vs. first install).
 */
export async function rotateToken(
  connectionId: string,
  newPlaintext: string,
  actor: VaultActor
): Promise<ProviderConnection> {
  const conn = await loadOwnedConnection(connectionId, actor, 'refresh');

  let ciphertext: string;
  try {
    ciphertext = encrypt(newPlaintext);
  } catch (err) {
    await logAccess({
      tenantId: actor.tenantId,
      connectionId,
      action: 'refresh',
      success: false,
      userId: actor.userId,
      ipAddress: actor.ipAddress,
    });
    throw err;
  }

  const updated = await connectionsRepo.update(conn.id, {
    encrypted_token: ciphertext,
  });
  await logAccess({
    tenantId: actor.tenantId,
    connectionId,
    action: 'refresh',
    success: true,
    userId: actor.userId,
    ipAddress: actor.ipAddress,
  });
  return updated;
}

/**
 * Clear the encrypted token, mark the connection disconnected, and
 * audit. Wrapper around `connectionsRepo.revoke()` that also writes
 * the access-log row.
 */
export async function revokeToken(
  connectionId: string,
  actor: VaultActor
): Promise<ProviderConnection> {
  const conn = await loadOwnedConnection(connectionId, actor, 'revoke');

  const revoked = await connectionsRepo.revoke(conn.id);
  await logAccess({
    tenantId: actor.tenantId,
    connectionId,
    action: 'revoke',
    success: true,
    userId: actor.userId,
    ipAddress: actor.ipAddress,
  });
  return revoked;
}
