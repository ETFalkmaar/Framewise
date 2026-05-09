import type { TenantChecklistStatus } from '@/types/database';
import type { ChecklistRepository } from '../../repositories/checklist';
import { generateId, getTimestamp, table } from './store';

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
  async markCompleted(tenantId, checklistItemId, notes = null) {
    const existing = Array.from(table('tenant_checklist_status').values()).find(
      (s) => s.tenant_id === tenantId && s.checklist_item_id === checklistItemId
    );
    const now = getTimestamp();
    if (existing) {
      const updated: TenantChecklistStatus = {
        ...existing,
        status: 'completed',
        completed_at: now,
        notes: notes ?? existing.notes,
      };
      table('tenant_checklist_status').set(existing.id, updated);
      return updated;
    }
    const row: TenantChecklistStatus = {
      id: generateId(),
      tenant_id: tenantId,
      checklist_item_id: checklistItemId,
      status: 'completed',
      completed_at: now,
      notes,
    };
    table('tenant_checklist_status').set(row.id, row);
    return row;
  },
  async reset(tenantId, checklistItemId) {
    const existing = Array.from(table('tenant_checklist_status').values()).find(
      (s) => s.tenant_id === tenantId && s.checklist_item_id === checklistItemId
    );
    if (!existing) {
      const row: TenantChecklistStatus = {
        id: generateId(),
        tenant_id: tenantId,
        checklist_item_id: checklistItemId,
        status: 'pending',
        completed_at: null,
        notes: null,
      };
      table('tenant_checklist_status').set(row.id, row);
      return row;
    }
    const updated: TenantChecklistStatus = {
      ...existing,
      status: 'pending',
      completed_at: null,
    };
    table('tenant_checklist_status').set(existing.id, updated);
    return updated;
  },
};
