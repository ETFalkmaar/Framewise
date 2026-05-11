import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/tenants/status-badge';
import { calculateTenantStats } from '@/lib/admin';
import { getCurrentUser, isUserSuperAdmin } from '@/lib/auth';
import { tenantsRepo } from '@/lib/data';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { TenantStatus } from '@/types/database';

/**
 * Per-tenant dashboard for the super-admin. Step 35 ships this
 * as a placeholder — basic info card, current status, quick
 * stats, and shortcut links to the existing per-tenant tools
 * (onboarding wizard, domain wizard, maintenance settings). The
 * full audit-log + connection feed + activity timeline lands in
 * step 36.
 */
export default async function AdminTenantDashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale; tenantId: string }>;
}) {
  const { locale, tenantId } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isUserSuperAdmin(user.id)) redirect('/account');

  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) notFound();

  const stats = await calculateTenantStats(tenant.id);
  const statusLabels: Record<TenantStatus, string> = {
    onboarding: 'Onboarding',
    live: 'Live',
    paused: 'Onderhoud',
    cancelled: 'Geannuleerd',
  };

  return (
    <main
      data-testid="admin-tenant-dashboard"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Super-admin · /admin/tenants/{tenant.id.slice(0, 8)}…
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-display-md font-bold tracking-tight">{tenant.name}</h1>
          <StatusBadge status={tenant.status} label={statusLabels[tenant.status]} />
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {tenant.country}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          Volledige dashboard met audit log + connection feed komt in stap 36.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card size="sm" data-testid="tenant-overview-card">
          <CardHeader>
            <CardTitle className="text-sm">Algemeen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Row label="Slug" value={tenant.slug} />
            <Row label="Custom domain" value={tenant.custom_domain ?? '—'} />
            <Row label="Standaardtaal" value={tenant.default_locale} />
            <Row label="VAT/CRIB" value={tenant.vat_number ?? tenant.crib_number ?? '—'} />
          </CardContent>
        </Card>

        <Card size="sm" data-testid="tenant-checklist-card">
          <CardHeader>
            <CardTitle className="text-sm">Setup-voortgang</CardTitle>
            <CardDescription className="text-xs">
              {stats?.checklistCompleted ?? 0} van {stats?.checklistTotal ?? 0} items afgerond
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={
                  (stats?.checklistPercentage ?? 0) === 100
                    ? 'h-full bg-emerald-500'
                    : 'bg-primary h-full'
                }
                style={{ width: `${stats?.checklistPercentage ?? 0}%` }}
              />
            </div>
            <p className="text-muted-foreground font-mono">
              Verplicht: {stats?.checklistRequiredCompleted ?? 0}/
              {stats?.checklistRequiredTotal ?? 0} ·{' '}
              {stats?.canGoLive ? '✓ klaar voor publish' : '⚠ vereist nog acties'}
            </p>
          </CardContent>
        </Card>

        <Card size="sm" data-testid="tenant-activity-card">
          <CardHeader>
            <CardTitle className="text-sm">Activiteit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Row label="Aangemaakt" value={tenant.created_at.slice(0, 10)} />
            <Row label="Laatste update" value={tenant.updated_at.slice(0, 10)} />
            <Row label="Dagen actief" value={String(stats?.daysOld ?? 0)} />
            <Row label="Actieve connectoren" value={String(stats?.activeConnectorCount ?? 0)} />
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="text-base font-semibold tracking-tight">Snelkoppelingen</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <DashboardLink href={`/admin/tenants/${tenant.id}/domain`} testId="link-domain">
            🌐 Domein
          </DashboardLink>
          <DashboardLink href={`/admin/tenants/${tenant.id}/maintenance`} testId="link-maintenance">
            🛠️ Onderhoudspagina
          </DashboardLink>
          <DashboardLink href={`/account/setup`} testId="link-setup">
            ✅ Setup checklist
          </DashboardLink>
          <DashboardLink href={`/admin/tenants`} testId="link-back">
            ← Terug naar overzicht
          </DashboardLink>
        </div>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 font-mono">
      <span className="text-muted-foreground w-24 shrink-0 text-[10px] tracking-wide uppercase">
        {label}
      </span>
      <span className="break-all">{value}</span>
    </div>
  );
}

function DashboardLink({
  href,
  testId,
  children,
}: {
  href: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="ring-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
    >
      {children}
    </Link>
  );
}
