'use server';

import {
  buildAuditLogCsv,
  getCsvFilename,
  listFilteredAuditEvents,
  type AuditAction,
} from '@/lib/admin';
import { isUserSuperAdmin, requireCurrentUser } from '@/lib/auth';
import { tenantsRepo } from '@/lib/data';

export interface ExportAuditLogCsvInput {
  tenantId: string;
  dateFrom?: string;
  dateTo?: string;
  actionTypes?: AuditAction[];
  performedByUserId?: string;
  searchQuery?: string;
  sortDir?: 'asc' | 'desc';
}

export interface ExportAuditLogCsvResult {
  csvContent: string;
  filename: string;
}

/**
 * Server action for the audit-log "Export" button (step 37).
 * Re-runs the filter chain server-side without a page cap so the
 * download mirrors what the user filtered to — not just the
 * current page. Super-admin only.
 */
export async function exportAuditLogCsvAction(
  input: ExportAuditLogCsvInput
): Promise<ExportAuditLogCsvResult> {
  const user = await requireCurrentUser();
  if (!isUserSuperAdmin(user.id)) {
    throw new Error('Forbidden');
  }

  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const result = await listFilteredAuditEvents({
    tenantId: input.tenantId,
    dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
    dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
    actionTypes: input.actionTypes,
    performedByUserId: input.performedByUserId,
    searchQuery: input.searchQuery,
    sortDir: input.sortDir ?? 'desc',
    pageSize: 10_000,
    page: 1,
  });

  return {
    csvContent: buildAuditLogCsv(result.events),
    filename: getCsvFilename(tenant.slug),
  };
}
