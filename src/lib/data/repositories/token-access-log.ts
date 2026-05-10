import type { TokenAccessLog } from '@/types/database';
import { createRepoProxy } from './_proxy';

/**
 * Append-only audit log for every access of a tenant's encrypted
 * tokens. Read paths return rows newest-first; writes always insert
 * — there is no update / delete (rows are immutable for compliance).
 *
 * Keep this repository minimal — production may swap it for a
 * Postgres `INSERT ... RETURNING id` against an append-only table or
 * an external SIEM sink without changing call sites.
 */
export interface TokenAccessLogRepository {
  listByTenant(tenantId: string, limit?: number): Promise<TokenAccessLog[]>;
  listByConnection(connectionId: string, limit?: number): Promise<TokenAccessLog[]>;
  listAll(limit?: number): Promise<TokenAccessLog[]>;
  insert(entry: Omit<TokenAccessLog, 'id' | 'timestamp'>): Promise<TokenAccessLog>;
}

const { proxy, set } = createRepoProxy<TokenAccessLogRepository>('tokenAccessLogRepo');
export const tokenAccessLogRepo = proxy;
export const setTokenAccessLogRepo = set;
