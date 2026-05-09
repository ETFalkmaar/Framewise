import type { SupportHoursLog } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface SupportHoursRepository {
  log(data: Omit<SupportHoursLog, 'id' | 'logged_at'>): Promise<SupportHoursLog>;
  listByTenant(tenantId: string): Promise<SupportHoursLog[]>;
  /** Returns minutes remaining for the active billing period. */
  getRemainingForPeriod(
    tenantId: string,
    periodStart: string,
    periodEnd: string,
    quotaMinutes: number
  ): Promise<number>;
  resetForPeriod(tenantId: string, periodStart: string, periodEnd: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<SupportHoursRepository>('supportHoursRepo');
export const supportHoursRepo = proxy;
export const setSupportHoursRepo = set;
