import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuditFilters } from '@/components/admin/audit/audit-filters';
import { AuditTable } from '@/components/admin/audit/audit-table';
import { ExportCsvButton } from '@/components/admin/audit/export-csv-button';
import {
  DEFAULT_AUDIT_PAGE_SIZE,
  listFilteredAuditEvents,
  type AuditAction,
  type AuditLogFilters,
} from '@/lib/admin';
import { getCurrentUser, isUserSuperAdmin } from '@/lib/auth';
import { tenantsRepo } from '@/lib/data';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

const ALLOWED_ACTIONS = new Set<AuditAction>([
  'tenant_created',
  'tenant_updated',
  'site_published',
  'site_unpublished',
  'connection_added',
  'connection_removed',
  'domain_added',
  'domain_verified',
  'checklist_item_completed',
  'member_invited',
]);

/**
 * Dedicated audit-log viewer (step 37, fase 11 part 3/4).
 *
 * Builds a filter spec from query params, runs
 * `listFilteredAuditEvents` once, then hands the result to the
 * filter bar (to populate dropdown options), the table (current
 * page), and the CSV export button (which re-runs the same
 * filter set server-side without a page cap).
 */
export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, tenantId } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isUserSuperAdmin(user.id)) redirect('/account');

  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) notFound();

  const sp = await searchParams;
  const filters = parseAuditFiltersFromSearchParams(sp, tenantId);
  const result = await listFilteredAuditEvents(filters);

  const t = await getTranslations('admin.auditLogPage');
  const tFilters = await getTranslations('admin.auditLogPage.filters');
  const tColumns = await getTranslations('admin.auditLogPage.columns');
  const tDashboard = await getTranslations('admin.tenantDashboard.auditActions');

  const actionLabels: Record<AuditAction, string> = {
    tenant_created: tDashboard('tenant_created'),
    tenant_updated: tDashboard('tenant_updated'),
    site_published: tDashboard('site_published'),
    site_unpublished: tDashboard('site_unpublished'),
    connection_added: tDashboard('connection_added'),
    connection_removed: tDashboard('connection_removed'),
    domain_added: tDashboard('domain_added'),
    domain_verified: tDashboard('domain_verified'),
    checklist_item_completed: tDashboard('checklist_item_completed'),
    member_invited: tDashboard('member_invited'),
  };

  const exportFilters = {
    dateFrom: typeof sp.dateFrom === 'string' ? sp.dateFrom : undefined,
    dateTo: typeof sp.dateTo === 'string' ? sp.dateTo : undefined,
    actionTypes: filters.actionTypes,
    performedByUserId: filters.performedByUserId,
    searchQuery: filters.searchQuery,
    sortDir: filters.sortDir,
  };

  return (
    <main
      data-testid="audit-log-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-12"
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href={`/admin/tenants/${tenant.id}`}
            data-testid="back-to-dashboard"
            className="text-muted-foreground font-mono text-xs hover:underline"
          >
            ← {tenant.name}
          </Link>
          <h1 className="text-display-md mt-1 font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm" data-testid="audit-result-meta">
            {t('showingResults', {
              shown: result.events.length,
              total: result.totalCount,
            })}
          </p>
        </div>
        <ExportCsvButton
          tenantId={tenant.id}
          filters={exportFilters}
          copy={{
            cta: t('exportCsv'),
            pending: t('exporting'),
            error: t('exportError'),
          }}
        />
      </header>

      <AuditFilters
        initial={{
          dateFrom: typeof sp.dateFrom === 'string' ? sp.dateFrom : '',
          dateTo: typeof sp.dateTo === 'string' ? sp.dateTo : '',
          actionTypes: filters.actionTypes ?? [],
          performedByUserId: filters.performedByUserId ?? '',
          search: filters.searchQuery ?? '',
          sortDir: filters.sortDir ?? 'desc',
        }}
        uniqueActionTypes={result.uniqueActionTypes}
        uniqueUsers={result.uniqueUsers}
        copy={{
          title: tFilters('title'),
          dateFrom: tFilters('dateFrom'),
          dateTo: tFilters('dateTo'),
          actionTypes: tFilters('actionTypes'),
          performedBy: tFilters('performedBy'),
          search: tFilters('search'),
          reset: tFilters('reset'),
          allActions: tFilters('allActions'),
          allUsers: tFilters('allUsers'),
          actionLabels,
        }}
      />

      <AuditTable
        events={result.events}
        copy={{
          empty: t('empty'),
          columns: {
            timestamp: tColumns('timestamp'),
            action: tColumns('action'),
            performedBy: tColumns('performedBy'),
            details: tColumns('details'),
          },
          actionLabels,
          detailsToggle: t('detailsToggle'),
          detailsCollapse: t('detailsCollapse'),
        }}
      />

      {result.totalPages > 1 && (
        <nav
          data-testid="audit-pagination"
          className="text-muted-foreground mt-6 flex items-center justify-between text-xs"
        >
          <p>
            {t('pagination', {
              page: result.currentPage,
              totalPages: result.totalPages,
              totalCount: result.totalCount,
            })}
          </p>
          <div className="flex gap-2">
            {result.currentPage > 1 && (
              <a
                href={pageHref(sp, result.currentPage - 1)}
                data-testid="audit-page-prev"
                className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1 font-mono ring-1"
              >
                ← {t('prev')}
              </a>
            )}
            {result.currentPage < result.totalPages && (
              <a
                href={pageHref(sp, result.currentPage + 1)}
                data-testid="audit-page-next"
                className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1 font-mono ring-1"
              >
                {t('next')} →
              </a>
            )}
          </div>
        </nav>
      )}
    </main>
  );
}

function parseAuditFiltersFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
  tenantId: string
): AuditLogFilters {
  const get = (key: string): string | undefined => {
    const v = sp[key];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const filters: AuditLogFilters = { tenantId, pageSize: DEFAULT_AUDIT_PAGE_SIZE };

  const dateFrom = get('dateFrom');
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!Number.isNaN(d.getTime())) filters.dateFrom = d;
  }
  const dateTo = get('dateTo');
  if (dateTo) {
    // Include the whole day by snapping `dateTo` to the end of the picked day.
    const d = new Date(dateTo);
    if (!Number.isNaN(d.getTime())) {
      d.setUTCHours(23, 59, 59, 999);
      filters.dateTo = d;
    }
  }

  const action = get('actionType');
  if (action && action !== 'all' && ALLOWED_ACTIONS.has(action as AuditAction)) {
    filters.actionTypes = [action as AuditAction];
  }

  const userId = get('userId');
  if (userId && userId !== 'all') filters.performedByUserId = userId;

  const search = get('search');
  if (search) filters.searchQuery = search;

  const sortDir = get('sortDir');
  if (sortDir === 'asc' || sortDir === 'desc') filters.sortDir = sortDir;

  const page = get('page');
  if (page) {
    const n = Number.parseInt(page, 10);
    if (Number.isFinite(n) && n > 0) filters.page = n;
  }

  return filters;
}

function pageHref(sp: Record<string, string | string[] | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') params.set(key, value);
  }
  params.set('page', String(page));
  return `?${params.toString()}`;
}
