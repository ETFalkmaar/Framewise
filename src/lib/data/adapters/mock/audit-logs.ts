import type { AuditLog } from '@/types/database';
import type { AuditLogsRepository } from '../../repositories/audit-logs';
import { generateId, getTimestamp, table } from './store';

const DEFAULT_LIMIT = 100;

export const mockAuditLogsRepo: AuditLogsRepository = {
  async listByTenant(tenantId, options) {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const actions = options?.actions;
    return Array.from(table('audit_logs').values())
      .filter((row) => row.tenant_id === tenantId)
      .filter((row) => (actions ? actions.includes(row.action) : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  },

  async findById(id) {
    return table('audit_logs').get(id) ?? null;
  },

  async create(data) {
    const row: AuditLog = {
      ...data,
      id: generateId(),
      created_at: getTimestamp(),
    };
    table('audit_logs').set(row.id, row);
    return row;
  },
};
