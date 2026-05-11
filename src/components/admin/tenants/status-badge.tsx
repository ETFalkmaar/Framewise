import { cn } from '@/lib/utils';
import type { TenantStatus } from '@/types/database';

const STATUS_STYLE: Record<TenantStatus, string> = {
  onboarding: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  live: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  paused: 'bg-muted text-muted-foreground ring-border',
  cancelled: 'bg-destructive/10 text-destructive ring-destructive/30',
};

const STATUS_DOT: Record<TenantStatus, string> = {
  onboarding: 'bg-amber-500',
  live: 'bg-emerald-500',
  paused: 'bg-muted-foreground/60',
  cancelled: 'bg-destructive',
};

export interface StatusBadgeProps {
  status: TenantStatus;
  label: string;
  className?: string;
}

/**
 * Reusable tenant-status pill for the admin tables and per-tenant
 * headers (step 35). Caller passes the localised label; the badge
 * only cares about the colour mapping.
 */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        STATUS_STYLE[status],
        className
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      {label}
    </span>
  );
}
