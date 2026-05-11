import { bookingsRepo, tenantsRepo } from '@/lib/data';
import type { Booking, BookingStatus } from '@/types/database';

/**
 * Cross-tenant booking KPIs (step 53, fase 14 part 5/7). Feeds the
 * super-admin booking dashboard so the operator can see at a glance
 * how many reservations are flowing through the platform on any
 * given day / week / month, plus per-tenant ratios.
 *
 * "Action needed" today = pending bookings whose start_time is in
 * the future — those are the ones a tenant should be confirming.
 *
 * The mock adapter has no aggregate queries; we walk the bookings
 * table once and bucket the rows. Step 119 swaps to a Supabase
 * materialised view or a `bookings_kpi` rollup table.
 */

export interface CrossTenantBookingKPIs {
  totalToday: number;
  totalThisWeek: number;
  totalThisMonth: number;
  pendingActionNeeded: number;
  byTenant: BookingsPerTenant[];
}

export interface BookingsPerTenant {
  tenantId: string;
  tenantName: string;
  count: number;
}

export interface KPIInput {
  /** Defaults to now — the test suite passes a fixed clock for
   *  deterministic windowing. */
  now?: Date;
  /** Optional status filter — used by the table on the dashboard
   *  page to share the same query path. Defaults to all statuses. */
  status?: BookingStatus[];
}

export async function getCrossTenantBookingKPIs(
  input: KPIInput = {}
): Promise<CrossTenantBookingKPIs> {
  const now = input.now ?? new Date();
  const todayStart = startOfDayUtc(now);
  const todayEnd = endOfDayUtc(now);
  const weekStart = startOfDayUtc(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  const monthStart = startOfDayUtc(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));

  const tenants = await tenantsRepo.list();
  const bookingsEnabled = tenants.filter((t) => t.bookings_enabled);

  // Pull every booking for the bookings-enabled tenants in one pass
  // each. Repo doesn't expose a cross-tenant list yet (Supabase swap
  // adds it). For a small number of tenants this is fine.
  const allBookings: Booking[] = [];
  for (const tenant of bookingsEnabled) {
    const rows = await bookingsRepo.listByTenant(tenant.id);
    allBookings.push(...rows);
  }

  const statusFilter = input.status;
  const visible = statusFilter
    ? allBookings.filter((b) => statusFilter.includes(b.status))
    : allBookings;

  let totalToday = 0;
  let totalThisWeek = 0;
  let totalThisMonth = 0;
  let pendingActionNeeded = 0;
  const perTenant = new Map<string, number>();

  for (const b of visible) {
    if (b.status === 'cancelled') continue;
    const start = new Date(b.start_time).getTime();
    if (start >= todayStart && start <= todayEnd) totalToday++;
    if (start >= weekStart && start <= todayEnd) totalThisWeek++;
    if (start >= monthStart && start <= todayEnd + 30 * 24 * 60 * 60 * 1000) totalThisMonth++;
    if (b.status === 'pending' && start >= todayStart) pendingActionNeeded++;
    perTenant.set(b.tenant_id, (perTenant.get(b.tenant_id) ?? 0) + 1);
  }

  const byTenant: BookingsPerTenant[] = bookingsEnabled
    .map((t) => ({
      tenantId: t.id,
      tenantName: t.name,
      count: perTenant.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalToday,
    totalThisWeek,
    totalThisMonth,
    pendingActionNeeded,
    byTenant,
  };
}

export interface CrossTenantBookingsListInput {
  /** Limit to a specific tenant — `undefined` = all bookings-enabled. */
  tenantId?: string;
  status?: BookingStatus[];
  /** Page size. Defaults to 50, capped at 200 to keep payload bounded. */
  limit?: number;
  /** 0-indexed page offset. */
  page?: number;
}

export interface CrossTenantBookingRow {
  booking: Booking;
  tenantId: string;
  tenantName: string;
}

export interface CrossTenantBookingsListResult {
  rows: CrossTenantBookingRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Paginated cross-tenant booking list — the dashboard's table reads
 * this. Same shape as the rest of the admin tables for consistency.
 */
export async function listCrossTenantBookings(
  input: CrossTenantBookingsListInput = {}
): Promise<CrossTenantBookingsListResult> {
  const pageSize = Math.min(200, Math.max(10, input.limit ?? 50));
  const page = Math.max(0, input.page ?? 0);
  const tenants = await tenantsRepo.list();
  const bookingsEnabled = tenants.filter((t) => t.bookings_enabled);
  const tenantsById = new Map(bookingsEnabled.map((t) => [t.id, t] as const));
  const candidates = input.tenantId
    ? bookingsEnabled.filter((t) => t.id === input.tenantId)
    : bookingsEnabled;

  const allRows: CrossTenantBookingRow[] = [];
  for (const tenant of candidates) {
    const rows = await bookingsRepo.listByTenant(tenant.id, { status: input.status });
    for (const booking of rows) {
      allRows.push({ booking, tenantId: tenant.id, tenantName: tenant.name });
    }
  }
  // Most-recent start_time first — booking-management has a "now and
  // soon" focus, so DESC keeps the operator on the items they actually
  // need to action.
  allRows.sort((a, b) => b.booking.start_time.localeCompare(a.booking.start_time));

  const total = allRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const sliceStart = safePage * pageSize;
  const sliced = allRows.slice(sliceStart, sliceStart + pageSize);

  // Surface tenant name from the map (safety belt if the snapshot
  // ever drifts between the two repo calls).
  for (const row of sliced) {
    const tenant = tenantsById.get(row.tenantId);
    if (tenant) row.tenantName = tenant.name;
  }

  return {
    rows: sliced,
    total,
    page: safePage,
    pageSize,
    pageCount,
  };
}

function startOfDayUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
}
function endOfDayUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999);
}
