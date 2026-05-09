import type { TenantChecklistStatus } from '@/types/database';
import type { ChecklistRepository } from '../../repositories/checklist';
import { generateId, getTimestamp, table } from './store';

function findRow(tenantId: string, checklistItemId: string): TenantChecklistStatus | undefined {
  return Array.from(table('tenant_checklist_status').values()).find(
    (s) => s.tenant_id === tenantId && s.checklist_item_id === checklistItemId
  );
}

function upsertRow(
  tenantId: string,
  checklistItemId: string,
  patch: Partial<TenantChecklistStatus>
): TenantChecklistStatus {
  const existing = findRow(tenantId, checklistItemId);
  if (existing) {
    const updated: TenantChecklistStatus = { ...existing, ...patch };
    table('tenant_checklist_status').set(existing.id, updated);
    return updated;
  }
  const row: TenantChecklistStatus = {
    id: generateId(),
    tenant_id: tenantId,
    checklist_item_id: checklistItemId,
    status: 'pending',
    completed_at: null,
    notes: null,
    ...patch,
  };
  table('tenant_checklist_status').set(row.id, row);
  return row;
}

export const mockChecklistRepo: ChecklistRepository = {
  async getTemplateForCountryAndPlan(country, planCode) {
    return Array.from(table('setup_checklist_items').values())
      .filter((item) => item.country === country && item.plan_code === planCode)
      .sort((a, b) => a.order_index - b.order_index);
  },

  async getTenantStatus(tenantId) {
    return Array.from(table('tenant_checklist_status').values()).filter(
      (s) => s.tenant_id === tenantId
    );
  },

  async listForTenant(tenantId) {
    return this.getTenantStatus(tenantId);
  },

  async markCompleted(tenantId, checklistItemId, notes = null) {
    return upsertRow(tenantId, checklistItemId, {
      status: 'completed',
      completed_at: getTimestamp(),
      notes: notes ?? findRow(tenantId, checklistItemId)?.notes ?? null,
    });
  },

  async markPending(tenantId, checklistItemId) {
    return upsertRow(tenantId, checklistItemId, {
      status: 'pending',
      completed_at: null,
    });
  },

  async markSkipped(tenantId, checklistItemId, notes = null) {
    return upsertRow(tenantId, checklistItemId, {
      status: 'skipped',
      completed_at: getTimestamp(),
      notes: notes ?? findRow(tenantId, checklistItemId)?.notes ?? null,
    });
  },

  async reset(tenantId, checklistItemId) {
    return this.markPending(tenantId, checklistItemId);
  },

  async resetAll(tenantId) {
    const rows = Array.from(table('tenant_checklist_status').values()).filter(
      (s) => s.tenant_id === tenantId
    );
    for (const row of rows) {
      table('tenant_checklist_status').delete(row.id);
    }
  },
};
