'use client';

import type { Block } from '@/types/database';

export interface ConflictDialogCopy {
  title: string;
  description: string;
  theirVersion: string;
  yourChanges: string;
  /** Pattern with `{time}` placeholder. */
  savedAt: string;
  keepTheirs: string;
  overwriteWithMine: string;
}

export interface ConflictDialogProps {
  /** The server-side block returned by the conflicting save. */
  currentVersion: Block;
  /** The local block snapshot the user just tried to save. */
  yourChanges: Block;
  /** Discard local changes, take the server version. */
  onReload: () => void;
  /** Force-save the local version, ignoring the version check. */
  onOverwrite: () => void;
  copy: ConflictDialogCopy;
}

/**
 * Two-way conflict dialog (step 46 — fase 12 part 8/8). Renders
 * when `saveBlockContentAction` returns `conflict: true` — the
 * user gets a side-by-side preview and picks one path:
 *
 *  - **Hun versie behouden** → calls `onReload`, which should
 *    re-fetch (or use `currentVersion`) and reset the form to the
 *    server state.
 *  - **Mijn wijzigingen overschrijven** → calls `onOverwrite`,
 *    which should re-save WITHOUT `expectedVersion` so the
 *    optimistic-concurrency check is skipped.
 *
 * The dialog itself doesn't perform either action — it's a
 * presentation component. Wrapping logic (form state reset,
 * follow-up save) lives in the parent so the dialog stays
 * testable in isolation.
 */
export function ConflictDialog({
  currentVersion,
  yourChanges,
  onReload,
  onOverwrite,
  copy,
}: ConflictDialogProps): React.ReactElement {
  return (
    <div
      data-testid="conflict-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-background border-border w-full max-w-2xl rounded-lg border p-6 shadow-xl">
        <h2 id="conflict-dialog-title" className="text-lg font-semibold">
          {copy.title}
        </h2>
        <p className="text-muted-foreground mt-2 mb-4 text-sm">{copy.description}</p>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <section
            data-testid="conflict-theirs"
            className="border-border rounded-md border p-3"
            aria-label={copy.theirVersion}
          >
            <h3 className="text-sm font-medium">{copy.theirVersion}</h3>
            <p className="text-muted-foreground mt-1 font-mono text-[10px]">
              v{currentVersion.version} ·{' '}
              {copy.savedAt.replace('{time}', formatTimestamp(currentVersion.updated_at))}
            </p>
            <pre className="bg-muted/40 mt-2 max-h-40 overflow-auto rounded p-2 font-mono text-[10px] whitespace-pre-wrap">
              {truncatePayload(currentVersion.data)}
            </pre>
          </section>

          <section
            data-testid="conflict-yours"
            className="border-border rounded-md border p-3"
            aria-label={copy.yourChanges}
          >
            <h3 className="text-sm font-medium">{copy.yourChanges}</h3>
            <p className="text-muted-foreground mt-1 font-mono text-[10px]">
              v{yourChanges.version}
            </p>
            <pre className="bg-muted/40 mt-2 max-h-40 overflow-auto rounded p-2 font-mono text-[10px] whitespace-pre-wrap">
              {truncatePayload(yourChanges.data)}
            </pre>
          </section>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            data-testid="conflict-reload"
            onClick={onReload}
            className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 text-sm ring-1 transition"
          >
            {copy.keepTheirs}
          </button>
          <button
            type="button"
            data-testid="conflict-overwrite"
            onClick={onOverwrite}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md px-4 py-2 text-sm transition"
          >
            {copy.overwriteWithMine}
          </button>
        </div>
      </div>
    </div>
  );
}

function truncatePayload(data: Record<string, unknown>, max = 600): string {
  let json: string;
  try {
    json = JSON.stringify(data, null, 2);
  } catch {
    json = '[unserialisable]';
  }
  return json.length <= max ? json : `${json.slice(0, max - 1)}…`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
