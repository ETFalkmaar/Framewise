import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getCurrentUser, isUserSuperAdmin } from '@/lib/auth';
import { listTenantsForAdmin, type TenantListFilters } from '@/lib/admin';
import type { Locale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { TenantFilters } from '@/components/admin/tenants/tenant-filters';
import { TenantStatsCard } from '@/components/admin/tenants/tenant-stats-card';
import { TenantTable } from '@/components/admin/tenants/tenant-table';
import type { Country, SubscriptionPlanCode, TenantStatus } from '@/types/database';

const ALLOWED_STATUS = new Set<TenantStatus>(['onboarding', 'live', 'paused', 'cancelled']);
const ALLOWED_COUNTRY = new Set<Country>(['NL', 'CW']);
const ALLOWED_PLAN = new Set<SubscriptionPlanCode>(['basic', 'pro', 'enterprise']);
const ALLOWED_SORT = new Set<'name' | 'created_at' | 'status' | 'plan'>([
  'name',
  'created_at',
  'status',
  'plan',
]);

/**
 * Super-admin tenant overview (step 35, fase 11 start).
 *
 * Reads search/filter/sort/page from `searchParams`, hands the
 * sanitised filter object to `listTenantsForAdmin`, and renders
 * the stats card + filter bar + sortable table. Non-super-admin
 * visitors redirect to `/account` so the route is invisible to
 * customers.
 */
export default async function AdminTenantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isUserSuperAdmin(user.id)) redirect('/account');

  const sp = await searchParams;
  const filters = parseFilters(sp);

  const result = await listTenantsForAdmin(filters);
  const t = await getTranslations('admin.tenants');
  const tStatus = await getTranslations('admin.tenants.status');
  const tCols = await getTranslations('admin.tenants.columns');
  const tActions = await getTranslations('admin.tenants.actions');
  const tFilters = await getTranslations('admin.tenants.filters');
  const tCountry = await getTranslations('admin.tenants.country');
  const tPlan = await getTranslations('admin.tenants.plan');
  const tStats = await getTranslations('admin.tenants.stats');

  return (
    <main
      data-testid="admin-tenants-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-12"
    >
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Super-admin
          </p>
          <h1 className="text-display-md mt-1 font-bold tracking-tight">{t('title')}</h1>
        </div>
        <Link href="/admin/onboarding/new" data-testid="link-onboarding">
          <Button>{t('newClient')}</Button>
        </Link>
      </header>

      <TenantStatsCard
        tenants={result.tenants}
        totalCount={result.totalCount}
        copy={{
          total: tStats('total'),
          inOnboarding: tStats('inOnboarding'),
          readyToPublish: tStats('readyToPublish'),
          live: tStats('live'),
          paused: tStats('paused'),
        }}
      />

      <TenantFilters
        initial={{
          search: filters.search ?? '',
          status: filters.status ?? 'all',
          country: filters.country ?? 'all',
          plan: filters.plan ?? 'all',
        }}
        copy={{
          search: t('search'),
          status: tFilters('status'),
          country: tFilters('country'),
          plan: tFilters('plan'),
          reset: tFilters('reset'),
          statusOptions: {
            all: tStatus('all'),
            onboarding: tStatus('onboarding'),
            live: tStatus('live'),
            paused: tStatus('paused'),
            cancelled: tStatus('cancelled'),
          },
          countryOptions: {
            all: tCountry('all'),
            NL: tCountry('NL'),
            CW: tCountry('CW'),
          },
          planOptions: {
            all: tPlan('all'),
            basic: tPlan('basic'),
            pro: tPlan('pro'),
            enterprise: tPlan('enterprise'),
          },
        }}
      />

      <TenantTable
        tenants={result.tenants}
        copy={{
          columns: {
            name: tCols('name'),
            country: tCols('country'),
            plan: tCols('plan'),
            status: tCols('status'),
            progress: tCols('progress'),
            created: tCols('created'),
            actions: tCols('actions'),
          },
          statusLabels: {
            onboarding: tStatus('onboarding'),
            live: tStatus('live'),
            paused: tStatus('paused'),
            cancelled: tStatus('cancelled'),
          },
          actions: {
            openDashboard: tActions('openDashboard'),
            domain: tActions('domain'),
            maintenance: tActions('maintenance'),
            setup: tActions('setup'),
          },
          empty: t('empty'),
        }}
      />

      {result.totalPages > 1 && (
        <nav
          data-testid="tenant-pagination"
          className="text-muted-foreground mt-6 flex items-center justify-between text-xs"
        >
          <p>
            Pagina {result.currentPage} van {result.totalPages} · {result.totalCount} totaal
          </p>
          <div className="flex gap-2">
            {result.currentPage > 1 && (
              <a
                href={pageHref(sp, result.currentPage - 1)}
                className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1 font-mono ring-1"
              >
                ← Vorige
              </a>
            )}
            {result.currentPage < result.totalPages && (
              <a
                href={pageHref(sp, result.currentPage + 1)}
                className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1 font-mono ring-1"
              >
                Volgende →
              </a>
            )}
          </div>
        </nav>
      )}
    </main>
  );
}

function parseFilters(sp: Record<string, string | string[] | undefined>): TenantListFilters {
  const get = (key: string): string | undefined => {
    const v = sp[key];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const filters: TenantListFilters = {};
  const search = get('search');
  if (search) filters.search = search;

  const status = get('status');
  if (status === 'all' || (status && ALLOWED_STATUS.has(status as TenantStatus))) {
    filters.status = status as TenantListFilters['status'];
  }

  const country = get('country');
  if (country === 'all' || (country && ALLOWED_COUNTRY.has(country as Country))) {
    filters.country = country as TenantListFilters['country'];
  }

  const plan = get('plan');
  if (plan === 'all' || (plan && ALLOWED_PLAN.has(plan as SubscriptionPlanCode))) {
    filters.plan = plan as TenantListFilters['plan'];
  }

  const sortBy = get('sortBy');
  if (sortBy && ALLOWED_SORT.has(sortBy as 'name' | 'created_at' | 'status' | 'plan')) {
    filters.sortBy = sortBy as TenantListFilters['sortBy'];
  }

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
