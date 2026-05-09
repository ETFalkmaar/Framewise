import type { SupportHoursLog } from '@/types/database';
import type { SupportHoursRepository } from '../../repositories/support-hours';
import { generateId, getTimestamp, table } from './store';

export const mockSupportHoursRepo: SupportHoursRepository = {
  async log(data) {
    const row: SupportHoursLog = {
      ...data,
      id: generateId(),
      logged_at: getTimestamp(),
    };
    table('support_hours_log').set(row.id, row);
    return row;
  },
  async listByTenant(tenantId) {
    return Array.from(table('support_hours_log').values())
      .filter((l) => l.tenant_id === tenantId)
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  },
  async getRemainingForPeriod(tenantId, periodStart, periodEnd, quotaMinutes) {
    const used = Array.from(table('support_hours_log').values())
      .filter(
        (l) =>
          l.tenant_id === tenantId && l.period_start === periodStart && l.period_end === periodEnd
      )
      .reduce((sum, l) => sum + l.minutes_used, 0);
    return Math.max(0, quotaMinutes - used);
  },
  async resetForPeriod(tenantId, periodStart, periodEnd) {
    for (const [id, row] of Array.from(table('support_hours_log').entries())) {
      if (
        row.tenant_id === tenantId &&
        row.period_start === periodStart &&
        row.period_end === periodEnd
      ) {
        table('support_hours_log').delete(id);
      }
    }
  },
};
