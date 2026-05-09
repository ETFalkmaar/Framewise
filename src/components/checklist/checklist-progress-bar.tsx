import { cn } from '@/lib/utils';

export interface ChecklistProgressBarProps {
  total: number;
  completed: number;
  percentage: number;
  label: string;
  className?: string;
}

export function ChecklistProgressBar({
  total,
  completed,
  percentage,
  label,
  className,
}: ChecklistProgressBarProps) {
  const safe = Math.max(0, Math.min(100, percentage));

  return (
    <div className={cn('space-y-2', className)} data-testid="checklist-progress-bar">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-muted-foreground font-mono text-xs">
          {label} <span className="text-foreground">{completed}</span> / {total}
        </p>
        <p className="text-foreground font-mono text-xs font-semibold">{safe}%</p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            safe === 100 ? 'bg-emerald-500' : 'bg-primary'
          )}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}
