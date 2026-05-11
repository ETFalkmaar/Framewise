'use client';

import type { AutoSaveStatus } from '@/lib/hooks/use-auto-save';

export interface SaveStatusIndicatorCopy {
  saving: string;
  savedRecently: string;
  /** Pattern with `{time}` placeholder, e.g. "Opgeslagen om 14:32". */
  savedAt: string;
  conflict: string;
  error: string;
}

export interface SaveStatusIndicatorProps {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  copy: SaveStatusIndicatorCopy;
}

/**
 * Tiny inline status pill that lives next to the block-form Save
 * button (step 46 — fase 12 part 8/8). Three states actually
 * show text:
 *   - `saving`    → "Bezig met opslaan…"
 *   - `saved`     → "✓ Opgeslagen" (flashes for ~2s post-save)
 *   - `idle` with `lastSavedAt` → "Opgeslagen om HH:MM"
 *   - `conflict`  → "⚠ Conflict"
 *   - `error`     → "⚠ Opslaan mislukt"
 *
 * Renders empty when status is `idle` AND we've never saved this
 * session — the indicator should be invisible until the customer
 * has something to look at.
 *
 * `aria-live="polite"` so screen readers announce status changes
 * without yanking focus.
 */
export function SaveStatusIndicator({
  status,
  lastSavedAt,
  copy,
}: SaveStatusIndicatorProps): React.ReactElement | null {
  const label = (() => {
    switch (status) {
      case 'saving':
        return copy.saving;
      case 'saved':
        return copy.savedRecently;
      case 'conflict':
        return copy.conflict;
      case 'error':
        return copy.error;
      case 'idle':
        if (lastSavedAt) {
          return copy.savedAt.replace('{time}', formatClock(lastSavedAt));
        }
        return '';
      default:
        return '';
    }
  })();

  if (!label) return null;

  const tone =
    status === 'error' || status === 'conflict'
      ? 'text-destructive'
      : status === 'saved'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-muted-foreground';

  return (
    <span
      data-testid={`save-status-${status}`}
      aria-live="polite"
      className={`font-mono text-[11px] ${tone}`}
    >
      {label}
    </span>
  );
}

function formatClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
