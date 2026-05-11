import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/admin/tenants/status-badge';
import { Link } from '@/i18n/navigation';
import type { Tenant, TenantStatus } from '@/types/database';

const COUNTRY_FLAG: Record<'NL' | 'CW', string> = { NL: '🇳🇱', CW: '🇨🇼' };

interface HeaderCopy {
  statusLabels: Record<TenantStatus, string>;
  openSite: string;
  setupChecklist: string;
  domain: string;
  maintenance: string;
  /** Step 52 — link to the per-tenant email-stub audit viewer. */
  emailLog: string;
}

export interface DashboardHeaderProps {
  tenant: Tenant;
  planCode: string | null;
  daysOld: number;
  copy: HeaderCopy;
}

/**
 * Top-of-page banner on the per-tenant dashboard (step 36).
 * Shows name + status + plan + country + days-old plus a row of
 * shortcut links to the other admin tools so the super-admin
 * never has to back-navigate to switch tools.
 */
export function DashboardHeader({ tenant, planCode, daysOld, copy }: DashboardHeaderProps) {
  return (
    <header data-testid="dashboard-header" className="mb-8 space-y-4">
      <div>
        <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Super-admin · /admin/tenants/{tenant.id.slice(0, 8)}…
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-display-md font-bold tracking-tight">{tenant.name}</h1>
          <StatusBadge status={tenant.status} label={copy.statusLabels[tenant.status]} />
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {COUNTRY_FLAG[tenant.country]} {tenant.country}
          </Badge>
          {planCode && (
            <Badge variant="secondary" className="font-mono text-[10px] uppercase">
              {planCode}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          <span className="font-mono">{tenant.slug}</span>
          {tenant.custom_domain && (
            <>
              {' · '}
              <span className="font-mono">{tenant.custom_domain}</span>
            </>
          )}
          {' · '}
          <span>{daysOld} dagen actief</span>
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        <a
          href={`/sites/${tenant.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="header-action-open-site"
          className="ring-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
        >
          🌐 {copy.openSite}
        </a>
        <Link
          href="/account/setup"
          data-testid="header-action-setup"
          className="ring-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
        >
          ✅ {copy.setupChecklist}
        </Link>
        <Link
          href={`/admin/tenants/${tenant.id}/domain`}
          data-testid="header-action-domain"
          className="ring-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
        >
          🔗 {copy.domain}
        </Link>
        <Link
          href={`/admin/tenants/${tenant.id}/maintenance`}
          data-testid="header-action-maintenance"
          className="ring-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
        >
          🛠️ {copy.maintenance}
        </Link>
        <Link
          href={`/admin/tenants/${tenant.id}/emails`}
          data-testid="header-action-email-log"
          className="ring-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
        >
          ✉ {copy.emailLog}
        </Link>
      </nav>
    </header>
  );
}
