import { listRecentAuditEvents, type AuditAction, type AuditLogEvent } from './audit-log-view';

/**
 * Full audit-log query layer for the dedicated viewer at
 * `/admin/tenants/[tenantId]/audit` (step 37, fase 11 part 3/4).
 *
 * Stap 36's `listRecentAuditEvents` returns the most recent N
 * for the dashboard card. This module is the heavyweight cousin:
 * full set → filter chain → sort → paginate, and also derives
 * the dropdown options (unique action types, unique users) the
 * filter UI needs to render. Filters compose as AND across
 * dimensions; within `actionTypes` it's OR (multi-select).
 *
 * The free-text `searchQuery` is a case-insensitive substring
 * match over the JSON-serialised `metadata` object plus the
 * `performedByUserName` — what the human sees in the row.
 */
export interface AuditLogFilters {
  tenantId: string;
  dateFrom?: Date;
  dateTo?: Date;
  /** Empty / undefined → all action types. */
  actionTypes?: AuditAction[];
  performedByUserId?: string;
  searchQuery?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface AuditLogResult {
  events: AuditLogEvent[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  uniqueActionTypes: AuditAction[];
  uniqueUsers: Array<{ id: string; name: string }>;
}

export const DEFAULT_AUDIT_PAGE_SIZE = 50;
/**
 * The synth feed runs over `connections + memberships + tenant`,
 * so the practical cap is in the low thousands. Pulling 10 000 is
 * a comfortable headroom for the CSV-export "all events" call.
 */
const FULL_FETCH_LIMIT = 10_000;

export async function listFilteredAuditEvents(filters: AuditLogFilters): Promise<AuditLogResult> {
  const all = await listRecentAuditEvents({
    tenantId: filters.tenantId,
    limit: FULL_FETCH_LIMIT,
  });

  const dateFromMs = filters.dateFrom ? filters.dateFrom.getTime() : null;
  const dateToMs = filters.dateTo ? filters.dateTo.getTime() : null;
  const actionTypeSet =
    filters.actionTypes && filters.actionTypes.length > 0
      ? new Set<AuditAction>(filters.actionTypes)
      : null;
  const userId = filters.performedByUserId ?? null;
  const search = filters.searchQuery?.trim().toLowerCase() ?? '';

  const filtered = all.filter((event) => {
    if (dateFromMs !== null || dateToMs !== null) {
      const t = Date.parse(event.createdAt);
      if (Number.isNaN(t)) return false;
      if (dateFromMs !== null && t < dateFromMs) return false;
      if (dateToMs !== null && t > dateToMs) return false;
    }
    if (actionTypeSet && !actionTypeSet.has(event.action)) return false;
    if (userId && event.performedByUserId !== userId) return false;
    if (search) {
      const haystack =
        `${event.performedByUserName ?? ''} ${JSON.stringify(event.metadata)}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const sortDir = filters.sortDir ?? 'desc';
  filtered.sort((a, b) => {
    const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return sortDir === 'asc' ? diff : -diff;
  });

  const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_AUDIT_PAGE_SIZE);
  const totalCount = filtered.length;
  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
  const currentPage = Math.max(1, Math.min(filters.page ?? 1, totalPages));
  const start = (currentPage - 1) * pageSize;
  const events = filtered.slice(start, start + pageSize);

  const uniqueActionTypes = Array.from(new Set<AuditAction>(all.map((e) => e.action))).sort();

  const userMap = new Map<string, string>();
  for (const e of all) {
    if (e.performedByUserId && e.performedByUserName) {
      userMap.set(e.performedByUserId, e.performedByUserName);
    }
  }
  const uniqueUsers = Array.from(userMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    events,
    totalCount,
    totalPages,
    currentPage,
    pageSize,
    uniqueActionTypes,
    uniqueUsers,
  };
}
