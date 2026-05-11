import { Card, CardContent } from '@/components/ui/card';
import type { TenantStats } from '@/lib/admin';

interface StatsCopy {
  checklistProgress: string;
  activeConnectors: string;
  daysActive: string;
  canGoLive: string;
  canGoLiveYes: string;
  canGoLiveNo: string;
}

export interface StatsOverviewProps {
  stats: TenantStats | null;
  copy: StatsCopy;
}

/**
 * Four-tile KPI strip on the per-tenant dashboard (step 36).
 * Mirrors the cards on the overview table but scoped to this
 * single tenant.
 */
export function StatsOverview({ stats, copy }: StatsOverviewProps) {
  if (!stats) {
    return (
      <Card data-testid="stats-overview-missing" className="mb-8">
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          Geen statistieken beschikbaar.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="stats-overview" className="mb-8">
      <CardContent className="grid grid-cols-2 gap-4 py-6 md:grid-cols-4">
        <Tile
          label={copy.checklistProgress}
          value={`${stats.checklistPercentage}%`}
          hint={`${stats.checklistRequiredCompleted}/${stats.checklistRequiredTotal} verplicht`}
        />
        <Tile label={copy.activeConnectors} value={String(stats.activeConnectorCount)} hint="" />
        <Tile label={copy.daysActive} value={String(stats.daysOld)} hint="" />
        <Tile
          label={copy.canGoLive}
          value={stats.canGoLive ? '✅' : '❌'}
          hint={stats.canGoLive ? copy.canGoLiveYes : copy.canGoLiveNo}
          tone={stats.canGoLive ? 'emerald' : 'amber'}
        />
      </CardContent>
    </Card>
  );
}

interface TileProps {
  label: string;
  value: string;
  hint: string;
  tone?: 'emerald' | 'amber';
}

function Tile({ label, value, hint, tone }: TileProps) {
  const colour =
    tone === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-300'
      : tone === 'amber'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-foreground';
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${colour}`}>{value}</p>
      {hint && <p className="text-muted-foreground font-mono text-[11px]">{hint}</p>}
    </div>
  );
}
