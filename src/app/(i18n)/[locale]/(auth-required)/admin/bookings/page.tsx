import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getCrossTenantBookingKPIs, listCrossTenantBookings } from '@/lib/bookings/admin-kpi';
import { getCurrentUser, isUserSuperAdmin } from '@/lib/auth';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { BookingStatus } from '@/types/database';

const ALL_STATUSES = new Set<BookingStatus>([
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
]);

/**
 * Cross-tenant booking dashboard (step 53, fase 14 part 5/7).
 * Super-admin only — gives the operator a one-pane view of every
 * booking flowing through every bookings-enabled tenant without
 * needing to switch tenants. KPI strip on top, per-tenant counts in
 * the middle, paginated booking table at the bottom.
 *
 * Filters via query params (`?tenantId=`, `?status=`, `?page=`) so
 * URLs are shareable + bookmarkable.
 */
export default async function AdminBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ tenantId?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isSuperAdmin = await isUserSuperAdmin(user.id);
  if (!isSuperAdmin) notFound();

  const t = await getTranslations('adminBookings');

  const status = parseStatuses(search.status);
  const tenantFilter = search.tenantId?.trim() || undefined;
  const pageNum = Number(search.page);
  const page = Number.isFinite(pageNum) && pageNum >= 0 ? Math.floor(pageNum) : 0;

  const [kpis, list] = await Promise.all([
    getCrossTenantBookingKPIs({ status }),
    listCrossTenantBookings({
      tenantId: tenantFilter,
      status,
      page,
      limit: 50,
    }),
  ]);

  const statusLabels: Record<BookingStatus, string> = {
    pending: t('status.pending'),
    confirmed: t('status.confirmed'),
    cancelled: t('status.cancelled'),
    completed: t('status.completed'),
    no_show: t('status.no_show'),
  };

  return (
    <main
      data-testid="admin-bookings-dashboard"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <Link
          href="/admin"
          data-testid="back-to-admin"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {t('backToAdmin')}
        </Link>
        <h1 className="text-display-md mt-2 font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('subtitle')}</p>
      </header>

      <section
        data-testid="admin-bookings-kpis"
        className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <KpiCard label={t('kpi.today')} value={kpis.totalToday} testid="kpi-today" />
        <KpiCard label={t('kpi.thisWeek')} value={kpis.totalThisWeek} testid="kpi-this-week" />
        <KpiCard label={t('kpi.thisMonth')} value={kpis.totalThisMonth} testid="kpi-this-month" />
        <KpiCard
          label={t('kpi.pendingAction')}
          value={kpis.pendingActionNeeded}
          testid="kpi-pending-action"
          tone={kpis.pendingActionNeeded > 0 ? 'warn' : 'default'}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{t('perTenant.title')}</h2>
        {kpis.byTenant.length === 0 ? (
          <p
            data-testid="admin-bookings-no-tenants"
            className="text-muted-foreground py-6 text-center text-sm"
          >
            {t('perTenant.empty')}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {kpis.byTenant.map((row) => (
              <li
                key={row.tenantId}
                data-testid={`tenant-row-${row.tenantId}`}
                className="border-border bg-muted/20 flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span className="font-medium">{row.tenantName}</span>
                <span className="font-mono text-xs">
                  {t('perTenant.count').replace('{count}', String(row.count))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('table.title')}</h2>
        {list.rows.length === 0 ? (
          <p
            data-testid="admin-bookings-empty"
            className="text-muted-foreground py-10 text-center text-sm"
          >
            {t('table.empty')}
          </p>
        ) : (
          <table
            data-testid="admin-bookings-table"
            className="border-border w-full border-collapse border text-sm"
          >
            <thead className="bg-muted/40">
              <tr>
                <th className="border-border border-b p-2 text-left font-mono text-xs uppercase">
                  {t('table.columns.tenant')}
                </th>
                <th className="border-border border-b p-2 text-left font-mono text-xs uppercase">
                  {t('table.columns.reference')}
                </th>
                <th className="border-border border-b p-2 text-left font-mono text-xs uppercase">
                  {t('table.columns.start')}
                </th>
                <th className="border-border border-b p-2 text-left font-mono text-xs uppercase">
                  {t('table.columns.guest')}
                </th>
                <th className="border-border border-b p-2 text-left font-mono text-xs uppercase">
                  {t('table.columns.party')}
                </th>
                <th className="border-border border-b p-2 text-left font-mono text-xs uppercase">
                  {t('table.columns.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map(({ booking, tenantId, tenantName }) => (
                <tr
                  key={booking.id}
                  data-testid={`booking-row-${booking.id}`}
                  className="border-border hover:bg-muted/30 border-b"
                >
                  <td className="border-border border-r p-2 text-xs">
                    <Link href={`/admin/tenants/${tenantId}`} className="hover:underline">
                      {tenantName}
                    </Link>
                  </td>
                  <td className="border-border border-r p-2 font-mono text-xs">
                    {booking.reference_code}
                  </td>
                  <td className="border-border border-r p-2 font-mono text-xs">
                    {new Date(booking.start_time).toLocaleString(
                      locale === 'nl' ? 'nl-NL' : locale === 'fr' ? 'fr-FR' : 'en-US',
                      {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}
                  </td>
                  <td className="border-border border-r p-2 text-xs">
                    {booking.customer_name}
                    <br />
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {booking.customer_email}
                    </span>
                  </td>
                  <td className="border-border border-r p-2 font-mono text-xs">
                    {booking.party_size}
                  </td>
                  <td className="p-2 font-mono text-[10px] uppercase">
                    {statusLabels[booking.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {list.pageCount > 1 ? (
          <Pagination
            page={list.page}
            pageCount={list.pageCount}
            buildHref={(p) => {
              const params = new URLSearchParams();
              if (tenantFilter) params.set('tenantId', tenantFilter);
              if (status) params.set('status', status.join(','));
              params.set('page', String(p));
              return `/admin/bookings?${params.toString()}`;
            }}
            labels={{ prev: t('table.prev'), next: t('table.next'), of: t('table.pageOf') }}
          />
        ) : null}
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  testid,
  tone,
}: {
  label: string;
  value: number;
  testid: string;
  tone?: 'default' | 'warn';
}): React.ReactElement {
  return (
    <div
      data-testid={testid}
      className={`border-border bg-muted/20 rounded-md border p-4 ${
        tone === 'warn' && value > 0 ? 'border-amber-500/40 bg-amber-500/10' : ''
      }`}
    >
      <p className="text-muted-foreground font-mono text-xs uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  buildHref,
  labels,
}: {
  page: number;
  pageCount: number;
  buildHref: (page: number) => string;
  labels: { prev: string; next: string; of: string };
}): React.ReactElement {
  return (
    <nav
      data-testid="admin-bookings-pagination"
      className="mt-4 flex items-center justify-between text-sm"
    >
      {page > 0 ? (
        <Link
          href={buildHref(page - 1)}
          data-testid="pagination-prev"
          className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1"
        >
          ← {labels.prev}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground font-mono text-xs">
        {labels.of.replace('{page}', String(page + 1)).replace('{total}', String(pageCount))}
      </span>
      {page < pageCount - 1 ? (
        <Link
          href={buildHref(page + 1)}
          data-testid="pagination-next"
          className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1"
        >
          {labels.next} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function parseStatuses(raw: string | undefined): BookingStatus[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as BookingStatus[];
  const valid = parts.filter((p) => ALL_STATUSES.has(p));
  return valid.length > 0 ? valid : undefined;
}
