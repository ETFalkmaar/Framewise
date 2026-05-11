import { Card, CardContent } from '@/components/ui/card';
import type { TenantWithStats } from '@/lib/admin';

interface StatsCopy {
  total: string;
  inOnboarding: string;
  readyToPublish: string;
  live: string;
  paused: string;
}

export interface TenantStatsCardProps {
  tenants: TenantWithStats[];
  /** Total across all pages — drives the "Totaal" tile. */
  totalCount: number;
  copy: StatsCopy;
}

/**
 * Top-level KPIs the super-admin sees above the table (step 35).
 * Numbers reflect the *currently visible* page for status counts
 * (so filters re-narrow them) but the "totaal" tile uses the
 * un-paginated total.
 */
export function TenantStatsCard({ tenants, totalCount, copy }: TenantStatsCardProps) {
  const inOnboarding = tenants.filter((t) => t.status === 'onboarding').length;
  const live = tenants.filter((t) => t.status === 'live').length;
  const paused = tenants.filter((t) => t.status === 'paused').length;
  const readyToPublish = tenants.filter(
    (t) => t.status !== 'live' && t.stats?.canGoLive === true
  ).length;

  return (
    <Card data-testid="tenant-stats-card" className="mb-6">
      <CardContent className="grid grid-cols-2 gap-4 py-6 md:grid-cols-5">
        <Stat label={copy.total} value={totalCount} />
        <Stat label={copy.inOnboarding} value={inOnboarding} tone="amber" />
        <Stat label={copy.readyToPublish} value={readyToPublish} tone="blue" />
        <Stat label={copy.live} value={live} tone="emerald" />
        <Stat label={copy.paused} value={paused} />
      </CardContent>
    </Card>
  );
}

const TONE: Record<NonNullable<StatProps['tone']>, string> = {
  amber: 'text-amber-700 dark:text-amber-300',
  blue: 'text-blue-700 dark:text-blue-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
};

interface StatProps {
  label: string;
  value: number;
  tone?: 'amber' | 'blue' | 'emerald';
}

function Stat({ label, value, tone }: StatProps) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${tone ? TONE[tone] : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}
