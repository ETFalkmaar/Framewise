'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import {
  deleteKnowledgeEntry,
  syncKnowledgeBase,
} from '@/app/(i18n)/[locale]/(auth-required)/account/site/agent/knowledge/actions';
import {
  KnowledgeEntryForm,
  type KnowledgeEntryFormCopy,
} from '@/components/agent/knowledge-entry-form';
import type {
  KnowledgeBaseDocument,
  KnowledgeDocumentType,
  KnowledgeSyncStatus,
} from '@/types/database';

export interface KnowledgeBaseManagerCopy {
  sync: {
    button: string;
    syncing: string;
    lastSynced: string;
    never: string;
    successWithCounts: (synced: number, removed: number) => string;
    successNoChanges: string;
    error: string;
  };
  sections: {
    autoSynced: string;
    autoSyncedHint: string;
    manual: string;
    manualHint: string;
    empty: string;
    addEntry: string;
  };
  statuses: Record<KnowledgeSyncStatus, string>;
  types: Record<KnowledgeDocumentType, string>;
  card: {
    edit: string;
    delete: string;
    deleteConfirm: string;
    source: string;
  };
  form: KnowledgeEntryFormCopy;
}

export interface KnowledgeBaseManagerProps {
  autoSynced: KnowledgeBaseDocument[];
  manualEntries: KnowledgeBaseDocument[];
  copy: KnowledgeBaseManagerCopy;
  locale: string;
}

type SyncState =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'success'; synced: number; removed: number }
  | { kind: 'error' };

/**
 * Knowledge base manager (step 58, fase 15 part 3/9). Three regions:
 *
 *  1. Sync header — button + last-synced timestamp. Calls
 *     `syncKnowledgeBase` and re-renders via `router.refresh()`.
 *  2. Auto-synced section — read-only list of docs derived from the
 *     site's published pages. Source link + status badge per row.
 *  3. Manual entries section — owner-curated Q&A. Edit + delete
 *     buttons per row, plus a "+ Nieuwe entry" button that opens
 *     the `<KnowledgeEntryForm>` modal.
 *
 * After every successful mutation we refresh the route so the server
 * component re-reads the repo and feeds fresh props back into this
 * client.
 */
export function KnowledgeBaseManager({
  autoSynced,
  manualEntries,
  copy,
  locale,
}: KnowledgeBaseManagerProps): React.ReactElement {
  const router = useRouter();
  const [syncState, setSyncState] = useState<SyncState>({ kind: 'idle' });
  const [syncPending, startSync] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [modal, setModal] = useState<
    { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; entry: KnowledgeBaseDocument }
  >({ kind: 'closed' });

  const lastSyncedAt = useMemo(() => {
    const stamps = autoSynced
      .map((d) => d.last_synced_at)
      .filter((s): s is string => Boolean(s))
      .sort();
    return stamps.length > 0 ? stamps[stamps.length - 1] : null;
  }, [autoSynced]);

  function handleSync() {
    setSyncState({ kind: 'syncing' });
    startSync(async () => {
      const r = await syncKnowledgeBase();
      if (!r.success) {
        setSyncState({ kind: 'error' });
        return;
      }
      setSyncState({
        kind: 'success',
        synced: r.syncedCount ?? 0,
        removed: r.removedCount ?? 0,
      });
      router.refresh();
    });
  }

  function handleDelete(doc: KnowledgeBaseDocument) {
    if (typeof window !== 'undefined' && !window.confirm(copy.card.deleteConfirm)) return;
    startDelete(async () => {
      await deleteKnowledgeEntry({ id: doc.id });
      router.refresh();
    });
  }

  function handleSaved() {
    setModal({ kind: 'closed' });
    router.refresh();
  }

  const syncing = syncPending || syncState.kind === 'syncing';

  return (
    <section data-testid="knowledge-base-manager" className="space-y-8">
      {/* Sync header */}
      <header className="border-border bg-muted/10 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div>
          <p data-testid="knowledge-last-synced" className="text-muted-foreground text-xs">
            {copy.sync.lastSynced}:{' '}
            <span className="text-foreground font-mono">
              {lastSyncedAt ? formatDate(lastSyncedAt, locale) : copy.sync.never}
            </span>
          </p>
          {syncState.kind === 'success' ? (
            <p
              data-testid="knowledge-sync-result"
              className="mt-1 text-xs text-emerald-700 dark:text-emerald-300"
            >
              {syncState.synced === 0 && syncState.removed === 0
                ? copy.sync.successNoChanges
                : copy.sync.successWithCounts(syncState.synced, syncState.removed)}
            </p>
          ) : null}
          {syncState.kind === 'error' ? (
            <p data-testid="knowledge-sync-error" className="text-destructive mt-1 text-xs">
              {copy.sync.error}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          data-testid="knowledge-sync-button"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {syncing ? copy.sync.syncing : copy.sync.button}
        </button>
      </header>

      {/* Auto-synced section */}
      <section data-testid="knowledge-auto-synced" className="space-y-3">
        <header>
          <h2 className="text-xl font-semibold">{copy.sections.autoSynced}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{copy.sections.autoSyncedHint}</p>
        </header>
        {autoSynced.length === 0 ? (
          <p
            data-testid="knowledge-auto-synced-empty"
            className="text-muted-foreground border-border rounded-md border border-dashed p-6 text-center text-sm"
          >
            {copy.sections.empty}
          </p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-md border">
            {autoSynced.map((doc) => (
              <li
                key={doc.id}
                data-testid={`knowledge-auto-${doc.id}`}
                className="flex flex-wrap items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium">{doc.title}</h3>
                    <StatusBadge status={doc.status} label={copy.statuses[doc.status]} />
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{doc.content}</p>
                  <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase">
                    <span>{copy.types[doc.type]}</span>
                    {doc.source_url ? (
                      <span>
                        {copy.card.source}: {doc.source_url}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Manual entries section */}
      <section data-testid="knowledge-manual-entries" className="space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{copy.sections.manual}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{copy.sections.manualHint}</p>
          </div>
          <button
            type="button"
            onClick={() => setModal({ kind: 'add' })}
            data-testid="knowledge-add-entry"
            className="border-border hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium"
          >
            {copy.sections.addEntry}
          </button>
        </header>
        {manualEntries.length === 0 ? (
          <p
            data-testid="knowledge-manual-empty"
            className="text-muted-foreground border-border rounded-md border border-dashed p-6 text-center text-sm"
          >
            {copy.sections.empty}
          </p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-md border">
            {manualEntries.map((doc) => (
              <li
                key={doc.id}
                data-testid={`knowledge-manual-${doc.id}`}
                className="flex flex-wrap items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium">{doc.title}</h3>
                    <StatusBadge status={doc.status} label={copy.statuses[doc.status]} />
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-3 text-sm whitespace-pre-wrap">
                    {doc.content}
                  </p>
                  <div className="text-muted-foreground mt-2 font-mono text-[10px] uppercase">
                    {copy.types[doc.type]}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModal({ kind: 'edit', entry: doc })}
                    data-testid={`knowledge-edit-${doc.id}`}
                    className="text-foreground hover:bg-muted rounded-md px-3 py-1.5 text-xs"
                  >
                    {copy.card.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    disabled={deletePending}
                    data-testid={`knowledge-delete-${doc.id}`}
                    className="text-destructive hover:bg-destructive/10 rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {copy.card.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Modal */}
      {modal.kind !== 'closed' ? (
        <KnowledgeEntryForm
          mode={modal.kind === 'edit' ? 'edit' : 'add'}
          initial={
            modal.kind === 'edit'
              ? {
                  id: modal.entry.id,
                  title: modal.entry.title,
                  content: modal.entry.content,
                  type: modal.entry.type,
                }
              : undefined
          }
          copy={copy.form}
          onClose={() => setModal({ kind: 'closed' })}
          onSaved={handleSaved}
        />
      ) : null}
    </section>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: KnowledgeSyncStatus;
  label: string;
}): React.ReactElement {
  const tone =
    status === 'synced'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : status === 'error'
        ? 'bg-destructive/15 text-destructive'
        : status === 'syncing'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          : 'bg-muted text-muted-foreground';
  return (
    <span
      data-testid={`knowledge-status-${status}`}
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${tone}`}
    >
      {label}
    </span>
  );
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
