import type { AuditLog, AuditLogAction } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface ListAuditLogsOptions {
  /** Cap the result set — defaults to 100. */
  limit?: number;
  /** Filter by action code(s) — useful for the "publish requests only" view. */
  actions?: AuditLogAction[];
}

export interface AuditLogsRepository {
  /** Newest-first within a tenant. */
  listByTenant(tenantId: string, options?: ListAuditLogsOptions): Promise<AuditLog[]>;
  findById(id: string): Promise<AuditLog | null>;
  create(data: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog>;
}

const { proxy, set } = createRepoProxy<AuditLogsRepository>('auditLogsRepo');
export const auditLogsRepo = proxy;
export const setAuditLogsRepo = set;
