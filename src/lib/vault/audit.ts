import { tokenAccessLogRepo } from '@/lib/data';
import type { TokenAccessLog, TokenAction } from '@/types/database';

export interface LogAccessInput {
  tenantId: string;
  connectionId: string;
  action: TokenAction;
  success: boolean;
  userId?: string | null;
  ipAddress?: string | null;
}

/**
 * Append an audit-log row for a vault access attempt.
 *
 * Defensive: any failure inside the logging path is swallowed so the
 * caller's primary action (decrypt / encrypt / revoke) is never
 * derailed by a write failure to the audit table. Returns `null` in
 * that case. Production should add a metrics counter for
 * `audit.log.failures` here in step 119.
 */
export async function logAccess(input: LogAccessInput): Promise<TokenAccessLog | null> {
  try {
    return await tokenAccessLogRepo.insert({
      tenant_id: input.tenantId,
      connection_id: input.connectionId,
      action: input.action,
      user_id: input.userId ?? null,
      ip_address: input.ipAddress ?? null,
      success: input.success,
    });
  } catch (err) {
    // Audit failure must NEVER bubble up — log to stderr in dev so it
    // doesn't disappear silently while still keeping the caller flow.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[vault/audit] failed to record access', err);
    }
    return null;
  }
}

export async function listForTenant(tenantId: string, limit = 50): Promise<TokenAccessLog[]> {
  return tokenAccessLogRepo.listByTenant(tenantId, limit);
}

export async function listForConnection(
  connectionId: string,
  limit = 50
): Promise<TokenAccessLog[]> {
  return tokenAccessLogRepo.listByConnection(connectionId, limit);
}
