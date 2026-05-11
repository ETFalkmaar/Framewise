import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import type { TenantWithStats } from '@/lib/admin';
import type { TenantStatus } from '@/types/database';

import { StatusBadge } from './status-badge';

interface TableCopy {
  columns: {
    name: string;
    country: string;
    plan: string;
    status: string;
    progress: string;
    created: string;
    actions: string;
  };
  statusLabels: Record<TenantStatus, string>;
  actions: {
    openDashboard: string;
    domain: string;
    maintenance: string;
    setup: string;
  };
  empty: string;
}

const COUNTRY_FLAG: Record<'NL' | 'CW', string> = { NL: '🇳🇱', CW: '🇨🇼' };

export interface TenantTableProps {
  tenants: TenantWithStats[];
  copy: TableCopy;
}

/**
 * Sortable header markup uses anchor tags with `sort=` query
 * params so a click reloads the page — server-driven sort means
 * we never have to ship the full tenant list to the client.
 */
export function TenantTable({ tenants, copy }: TenantTableProps) {
  if (tenants.length === 0) {
    return (
      <p
        data-testid="tenant-table-empty"
        className="text-muted-foreground py-12 text-center text-sm"
      >
        {copy.empty}
      </p>
    );
  }

  return (
    <div data-testid="tenant-table" className="border-border overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground border-border border-b text-xs">
          <tr>
            <SortHeader column="name" label={copy.columns.name} />
            <th className="px-3 py-2 text-left font-medium">{copy.columns.country}</th>
            <SortHeader column="plan" label={copy.columns.plan} />
            <SortHeader column="status" label={copy.columns.status} />
            <th className="px-3 py-2 text-left font-medium">{copy.columns.progress}</th>
            <SortHeader column="created_at" label={copy.columns.created} />
            <th className="px-3 py-2 text-right font-medium">{copy.columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr
              key={tenant.id}
              data-testid={`tenant-row-${tenant.id}`}
              className="border-border/60 hover:bg-muted/30 border-b transition-colors last:border-0"
            >
              <td className="px-3 py-3">
                <Link href={`/admin/tenants/${tenant.id}`} className="font-medium hover:underline">
                  {tenant.name}
                </Link>
                <p className="text-muted-foreground font-mono text-[11px]">{tenant.slug}</p>
              </td>
              <td className="px-3 py-3">
                <span className="font-mono text-xs">
                  {COUNTRY_FLAG[tenant.country]} {tenant.country}
                </span>
              </td>
              <td className="px-3 py-3">
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  {tenant.planCode ?? '—'}
                </Badge>
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={tenant.status} label={copy.statusLabels[tenant.status]} />
              </td>
              <td className="px-3 py-3">
                <ProgressCell stats={tenant.stats} />
              </td>
              <td className="text-muted-foreground px-3 py-3 font-mono text-[11px]">
                {formatDate(tenant.created_at)}
              </td>
              <td className="px-3 py-3 text-right">
                <RowActions tenantId={tenant.id} copy={copy} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressCell({ stats }: { stats: TenantWithStats['stats'] }) {
  if (!stats || stats.checklistTotal === 0) {
    return <span className="text-muted-foreground font-mono text-[11px]">—</span>;
  }
  const pct = stats.checklistPercentage;
  const tone = pct === 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
        {pct}% · {stats.checklistRequiredCompleted}/{stats.checklistRequiredTotal}
      </span>
    </div>
  );
}

function RowActions({ tenantId, copy }: { tenantId: string; copy: TableCopy }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Link
        href={`/admin/tenants/${tenantId}`}
        data-testid={`tenant-action-dashboard-${tenantId}`}
        className="ring-border bg-background hover:bg-muted inline-flex rounded-md px-2 py-1 font-mono text-[10px] ring-1"
      >
        {copy.actions.openDashboard}
      </Link>
      <Link
        href={`/admin/tenants/${tenantId}/domain`}
        data-testid={`tenant-action-domain-${tenantId}`}
        className="ring-border bg-background hover:bg-muted inline-flex rounded-md px-2 py-1 font-mono text-[10px] ring-1"
      >
        {copy.actions.domain}
      </Link>
      <Link
        href={`/admin/tenants/${tenantId}/maintenance`}
        data-testid={`tenant-action-maintenance-${tenantId}`}
        className="ring-border bg-background hover:bg-muted inline-flex rounded-md px-2 py-1 font-mono text-[10px] ring-1"
      >
        {copy.actions.maintenance}
      </Link>
    </div>
  );
}

function SortHeader({ column, label }: { column: string; label: string }) {
  // Server-driven sort: clicking just adds `sortBy=` + toggles `sortDir`.
  return (
    <th className="px-3 py-2 text-left font-medium">
      <SortLink column={column}>{label}</SortLink>
    </th>
  );
}

function SortLink({ column, children }: { column: string; children: React.ReactNode }) {
  // Server-driven sort — `?sortBy=…&sortDir=asc`. Plain `<a>` is
  // enough because the page is route-level, no nested route segments.
  return (
    <a
      href={`?sortBy=${column}&sortDir=asc`}
      className="hover:text-foreground"
      data-testid={`sort-${column}`}
    >
      {children}
    </a>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 10);
}
