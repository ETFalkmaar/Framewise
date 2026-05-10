import type { TokenAccessLog } from '@/types/database';
import type { TokenAccessLogRepository } from '../../repositories/token-access-log';
import { generateId, getTimestamp, table } from './store';

const DEFAULT_LIMIT = 100;

function newestFirst(a: TokenAccessLog, b: TokenAccessLog): number {
  return b.timestamp.localeCompare(a.timestamp);
}

export const mockTokenAccessLogRepo: TokenAccessLogRepository = {
  async listByTenant(tenantId, limit = DEFAULT_LIMIT) {
    return Array.from(table('token_access_log').values())
      .filter((row) => row.tenant_id === tenantId)
      .sort(newestFirst)
      .slice(0, limit);
  },

  async listByConnection(connectionId, limit = DEFAULT_LIMIT) {
    return Array.from(table('token_access_log').values())
      .filter((row) => row.connection_id === connectionId)
      .sort(newestFirst)
      .slice(0, limit);
  },

  async listAll(limit = DEFAULT_LIMIT) {
    return Array.from(table('token_access_log').values()).sort(newestFirst).slice(0, limit);
  },

  async insert(entry) {
    const row: TokenAccessLog = {
      id: generateId(),
      timestamp: getTimestamp(),
      ...entry,
    };
    table('token_access_log').set(row.id, row);
    return row;
  },
};
