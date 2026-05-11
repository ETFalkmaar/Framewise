'use client';

import { useState, useTransition } from 'react';

import {
  addManualKnowledgeEntry,
  updateManualKnowledgeEntry,
} from '@/app/(i18n)/[locale]/(auth-required)/account/site/agent/knowledge/actions';
import type { KnowledgeDocumentType } from '@/types/database';

export interface KnowledgeEntryFormCopy {
  addTitle: string;
  editTitle: string;
  type: string;
  titleLabel: string;
  titlePlaceholder: string;
  content: string;
  contentPlaceholder: string;
  contentHint: string;
  /** ICU template with {count} placeholder, e.g. "{count} tekens". */
  charactersTemplate: string;
  save: string;
  saving: string;
  cancel: string;
  saveError: string;
  typeOptions: Record<'manual_entry' | 'pricing' | 'contact_info', string>;
}

export interface KnowledgeEntryFormProps {
  mode: 'add' | 'edit';
  /** When mode === 'edit', the existing document id + values. */
  initial?: {
    id: string;
    title: string;
    content: string;
    type: KnowledgeDocumentType;
  };
  copy: KnowledgeEntryFormCopy;
  onClose: () => void;
  onSaved: () => void;
}

const MANUAL_TYPES: Array<'manual_entry' | 'pricing' | 'contact_info'> = [
  'manual_entry',
  'pricing',
  'contact_info',
];

/**
 * Manual knowledge-entry modal (step 58, fase 15 part 3/9).
 *
 * Renders inside a fixed-position overlay. Handles both create + edit
 * modes — `mode === 'edit'` pre-fills the form and switches to the
 * `updateManualKnowledgeEntry` action; otherwise calls
 * `addManualKnowledgeEntry`.
 *
 * Validation mirrors the server-side zod schema (title 3..200,
 * content 10..2000) so the user gets immediate feedback before the
 * round-trip.
 */
export function KnowledgeEntryForm({
  mode,
  initial,
  copy,
  onClose,
  onSaved,
}: KnowledgeEntryFormProps): React.ReactElement {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const isEditingAuto =
    mode === 'edit' && initial && initial.type !== 'manual_entry'
      ? !MANUAL_TYPES.includes(initial.type as 'manual_entry' | 'pricing' | 'contact_info')
      : false;
  const [type, setType] = useState<'manual_entry' | 'pricing' | 'contact_info'>(
    initial && MANUAL_TYPES.includes(initial.type as 'manual_entry' | 'pricing' | 'contact_info')
      ? (initial.type as 'manual_entry' | 'pricing' | 'contact_info')
      : 'manual_entry'
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const titleValid = trimmedTitle.length >= 3 && trimmedTitle.length <= 200;
  const contentValid = trimmedContent.length >= 10 && trimmedContent.length <= 2000;
  const canSubmit = titleValid && contentValid && !pending && !isEditingAuto;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      try {
        const result =
          mode === 'edit' && initial
            ? await updateManualKnowledgeEntry({
                id: initial.id,
                title: trimmedTitle,
                content: trimmedContent,
              })
            : await addManualKnowledgeEntry({
                title: trimmedTitle,
                content: trimmedContent,
                type,
              });
        if (!result.success) {
          setError(copy.saveError);
          return;
        }
        onSaved();
      } catch {
        setError(copy.saveError);
      }
    });
  }

  return (
    <div
      data-testid="knowledge-entry-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-background w-full max-w-xl rounded-lg shadow-xl">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <header className="border-border border-b px-6 py-4">
            <h2 className="text-lg font-semibold">
              {mode === 'edit' ? copy.editTitle : copy.addTitle}
            </h2>
          </header>

          <div className="space-y-4 px-6 py-5">
            {mode === 'add' ? (
              <label className="block">
                <span className="text-foreground mb-1 block text-sm font-medium">{copy.type}</span>
                <select
                  data-testid="knowledge-entry-type"
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as 'manual_entry' | 'pricing' | 'contact_info')
                  }
                  className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  {MANUAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {copy.typeOptions[t]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block">
              <span className="text-foreground mb-1 block text-sm font-medium">
                {copy.titleLabel}
              </span>
              <input
                data-testid="knowledge-entry-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={copy.titlePlaceholder}
                maxLength={200}
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="block">
              <span className="text-foreground mb-1 block text-sm font-medium">{copy.content}</span>
              <textarea
                data-testid="knowledge-entry-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={copy.contentPlaceholder}
                rows={8}
                maxLength={2000}
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                required
              />
              <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
                <span>{copy.contentHint}</span>
                <span data-testid="knowledge-entry-char-count">
                  {copy.charactersTemplate.replace('{count}', String(trimmedContent.length))}
                </span>
              </div>
            </label>

            {error ? (
              <p data-testid="knowledge-entry-error" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="border-border bg-muted/20 flex items-center justify-end gap-2 border-t px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              data-testid="knowledge-entry-cancel"
              className="text-foreground rounded-md px-4 py-2 text-sm hover:underline"
              disabled={pending}
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              data-testid="knowledge-entry-save"
              disabled={!canSubmit}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? copy.saving : copy.save}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
