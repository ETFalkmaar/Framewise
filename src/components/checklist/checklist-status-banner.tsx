import { cn } from '@/lib/utils';

export interface ChecklistStatusBannerProps {
  canGoLive: boolean;
  copy: {
    canGoLive: string;
    cannotGoLive: string;
    goLiveButton: string;
    goLiveDisabled: string;
  };
  className?: string;
}

export function ChecklistStatusBanner({ canGoLive, copy, className }: ChecklistStatusBannerProps) {
  if (canGoLive) {
    return (
      <div
        data-testid="checklist-banner-go-live"
        className={cn(
          'flex flex-wrap items-center justify-between gap-4 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4',
          className
        )}
      >
        <p className="font-medium text-emerald-700 dark:text-emerald-300">✓ {copy.canGoLive}</p>
        <button
          type="button"
          disabled
          aria-disabled
          title={copy.goLiveDisabled}
          className="ring-border bg-background cursor-not-allowed rounded-md px-3 py-2 font-mono text-xs opacity-60 ring-1"
        >
          {copy.goLiveButton}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="checklist-banner-pending"
      className={cn('rounded-lg border border-amber-500/40 bg-amber-500/5 p-4', className)}
    >
      <p className="font-medium text-amber-700 dark:text-amber-300">⚠ {copy.cannotGoLive}</p>
    </div>
  );
}
