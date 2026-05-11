'use client';

import { useEffect, useState, useTransition } from 'react';

import type { Block, BlockType, LocaleCode, Media } from '@/types/database';

import { saveBlockContentAction } from '@/app/(i18n)/[locale]/(auth-required)/account/site/pages/[pageId]/edit/actions';

import { ConflictDialog, type ConflictDialogCopy } from './conflict-dialog';
import { ImagePicker } from './image-picker';
import { LocaleTabs } from './locale-tabs';
import { SaveStatusIndicator, type SaveStatusIndicatorCopy } from './save-status-indicator';
import { TipTapEditor } from './tiptap-editor';

interface BlockEditModalCopy {
  title: string;
  cancel: string;
  save: string;
  saving: string;
  saved: string;
  saveError: string;
  comingSoon: string;
  tiptap: {
    bold: string;
    italic: string;
    link: string;
    linkUrl: string;
    linkApply: string;
    linkCancel: string;
    linkRemove: string;
    heading: string;
    bulletList: string;
  };
  blockForms: {
    textContent: string;
    heroTitle: string;
    heroSubtitle: string;
    heroCtaText: string;
    heroCtaUrl: string;
    heroOverlay: string;
    heroOverlayLight: string;
    heroOverlayDark: string;
    imageSelect: string;
    imageChange: string;
    imageNone: string;
    imageAlt: string;
    imageCaption: string;
  };
  imagePicker: {
    title: string;
    tabExisting: string;
    tabUpload: string;
    empty: string;
    cancel: string;
    upload: string;
    uploading: string;
  };
  locales: {
    tabLabels: Record<LocaleCode, string>;
    missingLabel: string;
  };
  /** Step 46 — save-status pill copy. */
  saveStatus: SaveStatusIndicatorCopy;
  /** Step 46 — conflict dialog copy. */
  conflict: ConflictDialogCopy;
}

export interface BlockEditModalProps {
  block: Block;
  pageId: string;
  locale: LocaleCode;
  mediaLibrary: Media[];
  open: boolean;
  onClose: () => void;
  copy: BlockEditModalCopy;
  /**
   * Step 45 — called optimistically with the new block `data` the
   * moment the user clicks Save (before the server action returns).
   * Lets the parent (SortableBlockList) refresh its local block list
   * so the preview iframe reloads with the new content immediately.
   * Optional — not all callers (history preview, tests) wire it up.
   */
  onLocalSave?: (blockId: string, newData: Record<string, unknown>) => void;
}

/**
 * Modal dialog that hosts the per-block-type edit forms (step
 * 41, fase 12 part 3/8). Only `text` and `hero` are wired up;
 * the rest of the block types render a "coming soon" placeholder
 * pointing at the follow-up steps that ship them.
 *
 * Saves go through the `saveBlockContentAction` server action,
 * which routes through the pure `saveBlockContentFor` core
 * (which is what the unit tests exercise — see
 * `src/lib/blocks/__tests__/save-block.test.ts`).
 */
export function BlockEditModal({
  block,
  pageId,
  locale,
  mediaLibrary,
  open,
  onClose,
  copy,
  onLocalSave,
}: BlockEditModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="block-edit-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12"
      onClick={onClose}
    >
      <div
        className="bg-background border-border w-full max-w-2xl rounded-lg border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{copy.title}</h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="block-edit-close"
            className="text-muted-foreground hover:text-foreground font-mono text-sm"
            aria-label={copy.cancel}
          >
            ✕
          </button>
        </div>

        <BlockEditForm
          block={block}
          pageId={pageId}
          locale={locale}
          mediaLibrary={mediaLibrary}
          onClose={onClose}
          copy={copy}
          onLocalSave={onLocalSave}
        />
      </div>
    </div>
  );
}

function BlockEditForm({
  block,
  pageId,
  locale,
  mediaLibrary,
  onClose,
  copy,
  onLocalSave,
}: {
  block: Block;
  pageId: string;
  locale: LocaleCode;
  mediaLibrary: Media[];
  onClose: () => void;
  copy: BlockEditModalCopy;
  onLocalSave?: (blockId: string, newData: Record<string, unknown>) => void;
}) {
  switch (block.block_type) {
    case 'text':
      return (
        <TextBlockForm
          block={block}
          pageId={pageId}
          locale={locale}
          onClose={onClose}
          copy={copy}
          onLocalSave={onLocalSave}
        />
      );
    case 'hero':
      return (
        <HeroBlockForm
          block={block}
          pageId={pageId}
          locale={locale}
          mediaLibrary={mediaLibrary}
          onClose={onClose}
          copy={copy}
          onLocalSave={onLocalSave}
        />
      );
    case 'image':
      return (
        <ImageBlockForm
          block={block}
          pageId={pageId}
          locale={locale}
          mediaLibrary={mediaLibrary}
          onClose={onClose}
          copy={copy}
          onLocalSave={onLocalSave}
        />
      );
    default:
      return <ComingSoonForm blockType={block.block_type} copy={copy} />;
  }
}

interface FormProps {
  block: Block;
  pageId: string;
  locale: LocaleCode;
  onClose: () => void;
  copy: BlockEditModalCopy;
  onLocalSave?: (blockId: string, newData: Record<string, unknown>) => void;
}

interface FormWithMediaProps extends FormProps {
  mediaLibrary: Media[];
}

function TextBlockForm({ block, pageId, locale, onClose, copy, onLocalSave }: FormProps) {
  const initialTranslations =
    (block.data.content_translations as Record<string, string> | undefined) ?? {};

  const [contentTranslations, setContentTranslations] = useState<Record<LocaleCode, string>>({
    nl: initialTranslations.nl ?? '',
    fr: initialTranslations.fr ?? '',
    en: initialTranslations.en ?? '',
  });
  const {
    pending,
    error,
    saved,
    save,
    conflictWith,
    dismissConflict,
    expectedVersion,
    setExpectedVersion,
  } = useSaveBlock();

  // Step 46 — pin expectedVersion at modal open, refresh on each
  // successful save so back-to-back edits stay in sync without
  // tripping their own follow-up saves.
  useEffect(() => {
    setExpectedVersion(block.version);
  }, [block.id, block.version, setExpectedVersion]);

  const buildPayload = () => ({
    content_translations: { ...initialTranslations, ...contentTranslations },
  });

  return (
    <div data-testid="text-block-form" className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">{copy.blockForms.textContent}</p>
        <LocaleTabs
          testidPrefix="text-content"
          defaultLocale={locale}
          values={contentTranslations}
          onChange={(loc, next) => setContentTranslations((prev) => ({ ...prev, [loc]: next }))}
          copy={copy.locales}
          renderField={(value, onChange, loc) => (
            <TipTapEditor
              key={loc}
              id={`text-content-${loc}`}
              initialContent={value}
              onChange={onChange}
              copy={copy.tiptap}
            />
          )}
        />
      </div>

      <FormFooter
        pending={pending}
        error={error}
        saved={saved}
        onCancel={onClose}
        onSave={() => {
          const newData = buildPayload();
          onLocalSave?.(block.id, newData);
          save({ pageId, blockId: block.id, newData, expectedVersion }, onClose);
        }}
        copy={copy}
        saveStatusCopy={copy.saveStatus}
      />

      {conflictWith && (
        <ConflictDialog
          currentVersion={conflictWith}
          yourChanges={{ ...block, data: buildPayload(), version: expectedVersion }}
          onReload={() => {
            // Discard local changes — close modal, server revalidate
            // re-renders with the conflicting (server-side) block.
            dismissConflict();
            onClose();
          }}
          onOverwrite={() => {
            // Force-save: skip the expectedVersion check so the
            // local payload lands regardless of the new server
            // version. After this the form closes via onClose on
            // success.
            const newData = buildPayload();
            onLocalSave?.(block.id, newData);
            save({ pageId, blockId: block.id, newData }, onClose);
          }}
          copy={copy.conflict}
        />
      )}
    </div>
  );
}

function HeroBlockForm({
  block,
  pageId,
  locale,
  mediaLibrary,
  onClose,
  copy,
  onLocalSave,
}: FormWithMediaProps) {
  const initial = block.data as Record<string, unknown>;
  const headlineTranslations =
    (initial.headline_translations as Record<string, string> | undefined) ?? {};
  const subheadlineTranslations =
    (initial.subheadline_translations as Record<string, string> | undefined) ?? {};
  const ctaTextTranslations =
    (initial.cta_text_translations as Record<string, string> | undefined) ?? {};

  const [headlines, setHeadlines] = useState<Record<LocaleCode, string>>({
    nl: headlineTranslations.nl ?? '',
    fr: headlineTranslations.fr ?? '',
    en: headlineTranslations.en ?? '',
  });
  const [subheadlines, setSubheadlines] = useState<Record<LocaleCode, string>>({
    nl: subheadlineTranslations.nl ?? '',
    fr: subheadlineTranslations.fr ?? '',
    en: subheadlineTranslations.en ?? '',
  });
  const [ctaTexts, setCtaTexts] = useState<Record<LocaleCode, string>>({
    nl: ctaTextTranslations.nl ?? '',
    fr: ctaTextTranslations.fr ?? '',
    en: ctaTextTranslations.en ?? '',
  });
  const [ctaLink, setCtaLink] = useState<string>((initial.cta_link as string) ?? '');
  const [overlay, setOverlay] = useState<string>((initial.background_overlay as string) ?? 'dark');
  const [imageUrl, setImageUrl] = useState<string>((initial.image_url as string) ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    pending,
    error,
    saved,
    save,
    conflictWith,
    dismissConflict,
    expectedVersion,
    setExpectedVersion,
  } = useSaveBlock();

  // Step 46 — pin expectedVersion at modal open (same pattern as TextBlockForm).
  useEffect(() => {
    setExpectedVersion(block.version);
  }, [block.id, block.version, setExpectedVersion]);

  const buildPayload = () => ({
    headline_translations: { ...headlineTranslations, ...headlines },
    subheadline_translations: { ...subheadlineTranslations, ...subheadlines },
    cta_text_translations: { ...ctaTextTranslations, ...ctaTexts },
    cta_link: ctaLink,
    background_overlay: overlay,
    image_url: imageUrl,
  });

  return (
    <div data-testid="hero-block-form" className="space-y-4">
      <ImagePreviewAndPicker imageUrl={imageUrl} onPick={() => setPickerOpen(true)} copy={copy} />

      <div>
        <p className="mb-2 text-sm font-medium">{copy.blockForms.heroTitle}</p>
        <LocaleTabs
          testidPrefix="hero-title"
          defaultLocale={locale}
          values={headlines}
          onChange={(loc, next) => setHeadlines((prev) => ({ ...prev, [loc]: next }))}
          copy={copy.locales}
          renderField={(value, onChange, loc) => (
            <input
              key={loc}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              data-testid={`hero-title-${loc}`}
              className="bg-background border-input w-full rounded-md border px-3 py-2 text-sm"
            />
          )}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{copy.blockForms.heroSubtitle}</p>
        <LocaleTabs
          testidPrefix="hero-subtitle"
          defaultLocale={locale}
          values={subheadlines}
          onChange={(loc, next) => setSubheadlines((prev) => ({ ...prev, [loc]: next }))}
          copy={copy.locales}
          renderField={(value, onChange, loc) => (
            <input
              key={loc}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              data-testid={`hero-subtitle-${loc}`}
              className="bg-background border-input w-full rounded-md border px-3 py-2 text-sm"
            />
          )}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{copy.blockForms.heroCtaText}</p>
        <LocaleTabs
          testidPrefix="hero-cta-text"
          defaultLocale={locale}
          values={ctaTexts}
          onChange={(loc, next) => setCtaTexts((prev) => ({ ...prev, [loc]: next }))}
          copy={copy.locales}
          renderField={(value, onChange, loc) => (
            <input
              key={loc}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              data-testid={`hero-cta-text-${loc}`}
              className="bg-background border-input w-full rounded-md border px-3 py-2 text-sm"
            />
          )}
        />
      </div>

      <TextInput
        id="hero-cta-url"
        label={copy.blockForms.heroCtaUrl}
        value={ctaLink}
        onChange={setCtaLink}
      />

      <label className="block">
        <span className="text-sm font-medium">{copy.blockForms.heroOverlay}</span>
        <select
          value={overlay}
          onChange={(e) => setOverlay(e.target.value)}
          data-testid="hero-overlay"
          className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="light">{copy.blockForms.heroOverlayLight}</option>
          <option value="dark">{copy.blockForms.heroOverlayDark}</option>
        </select>
      </label>

      <FormFooter
        pending={pending}
        error={error}
        saved={saved}
        onCancel={onClose}
        onSave={() => {
          const newData = buildPayload();
          onLocalSave?.(block.id, newData);
          save({ pageId, blockId: block.id, newData, expectedVersion }, onClose);
        }}
        copy={copy}
        saveStatusCopy={copy.saveStatus}
      />

      {conflictWith && (
        <ConflictDialog
          currentVersion={conflictWith}
          yourChanges={{ ...block, data: buildPayload(), version: expectedVersion }}
          onReload={() => {
            dismissConflict();
            onClose();
          }}
          onOverwrite={() => {
            const newData = buildPayload();
            onLocalSave?.(block.id, newData);
            save({ pageId, blockId: block.id, newData }, onClose);
          }}
          copy={copy.conflict}
        />
      )}

      {pickerOpen && (
        <ImagePicker
          initial={mediaLibrary}
          onClose={() => setPickerOpen(false)}
          onSelect={(url) => {
            setImageUrl(url);
            setPickerOpen(false);
          }}
          copy={copy.imagePicker}
        />
      )}
    </div>
  );
}

function ComingSoonForm({ blockType, copy }: { blockType: BlockType; copy: BlockEditModalCopy }) {
  return (
    <div
      data-testid={`coming-soon-${blockType}`}
      className="text-muted-foreground border-border bg-muted/40 rounded-md border-2 border-dashed p-8 text-center text-sm"
    >
      {copy.comingSoon}
    </div>
  );
}

function ImageBlockForm({
  block,
  pageId,
  locale,
  mediaLibrary,
  onClose,
  copy,
  onLocalSave,
}: FormWithMediaProps) {
  const initial = block.data as Record<string, unknown>;
  const altTranslations = (initial.alt_translations as Record<string, string> | undefined) ?? {};
  const captionTranslations =
    (initial.caption_translations as Record<string, string> | undefined) ?? {};

  const [imageUrl, setImageUrl] = useState<string>((initial.image_url as string) ?? '');
  const [altTexts, setAltTexts] = useState<Record<LocaleCode, string>>({
    nl: altTranslations.nl ?? '',
    fr: altTranslations.fr ?? '',
    en: altTranslations.en ?? '',
  });
  const [captions, setCaptions] = useState<Record<LocaleCode, string>>({
    nl: captionTranslations.nl ?? '',
    fr: captionTranslations.fr ?? '',
    en: captionTranslations.en ?? '',
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    pending,
    error,
    saved,
    save,
    conflictWith,
    dismissConflict,
    expectedVersion,
    setExpectedVersion,
  } = useSaveBlock();

  // Step 46 — pin expectedVersion at modal open.
  useEffect(() => {
    setExpectedVersion(block.version);
  }, [block.id, block.version, setExpectedVersion]);

  const buildPayload = () => ({
    image_url: imageUrl,
    alt_translations: { ...altTranslations, ...altTexts },
    caption_translations: { ...captionTranslations, ...captions },
  });

  return (
    <div data-testid="image-block-form" className="space-y-4">
      <ImagePreviewAndPicker imageUrl={imageUrl} onPick={() => setPickerOpen(true)} copy={copy} />

      <div>
        <p className="mb-2 text-sm font-medium">{copy.blockForms.imageAlt}</p>
        <LocaleTabs
          testidPrefix="image-alt"
          defaultLocale={locale}
          values={altTexts}
          onChange={(loc, next) => setAltTexts((prev) => ({ ...prev, [loc]: next }))}
          copy={copy.locales}
          renderField={(value, onChange, loc) => (
            <input
              key={loc}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              data-testid={`image-alt-${loc}`}
              className="bg-background border-input w-full rounded-md border px-3 py-2 text-sm"
            />
          )}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{copy.blockForms.imageCaption}</p>
        <LocaleTabs
          testidPrefix="image-caption"
          defaultLocale={locale}
          values={captions}
          onChange={(loc, next) => setCaptions((prev) => ({ ...prev, [loc]: next }))}
          copy={copy.locales}
          renderField={(value, onChange, loc) => (
            <input
              key={loc}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              data-testid={`image-caption-${loc}`}
              className="bg-background border-input w-full rounded-md border px-3 py-2 text-sm"
            />
          )}
        />
      </div>

      <FormFooter
        pending={pending}
        error={error}
        saved={saved}
        onCancel={onClose}
        onSave={() => {
          const newData = buildPayload();
          onLocalSave?.(block.id, newData);
          save({ pageId, blockId: block.id, newData, expectedVersion }, onClose);
        }}
        copy={copy}
        saveStatusCopy={copy.saveStatus}
      />

      {conflictWith && (
        <ConflictDialog
          currentVersion={conflictWith}
          yourChanges={{ ...block, data: buildPayload(), version: expectedVersion }}
          onReload={() => {
            dismissConflict();
            onClose();
          }}
          onOverwrite={() => {
            const newData = buildPayload();
            onLocalSave?.(block.id, newData);
            save({ pageId, blockId: block.id, newData }, onClose);
          }}
          copy={copy.conflict}
        />
      )}

      {pickerOpen && (
        <ImagePicker
          initial={mediaLibrary}
          onClose={() => setPickerOpen(false)}
          onSelect={(url, alt) => {
            setImageUrl(url);
            if (alt && !altTexts[locale]) {
              setAltTexts((prev) => ({ ...prev, [locale]: alt }));
            }
            setPickerOpen(false);
          }}
          copy={copy.imagePicker}
        />
      )}
    </div>
  );
}

function ImagePreviewAndPicker({
  imageUrl,
  onPick,
  copy,
}: {
  imageUrl: string;
  onPick: () => void;
  copy: BlockEditModalCopy;
}) {
  return (
    <div className="space-y-2">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          data-testid="image-preview"
          className="max-h-48 w-full rounded-md object-cover"
        />
      ) : (
        <div
          data-testid="image-preview-empty"
          className="border-border bg-muted/40 text-muted-foreground rounded-md border-2 border-dashed p-6 text-center text-xs"
        >
          {copy.blockForms.imageNone}
        </div>
      )}
      <button
        type="button"
        data-testid="image-picker-trigger"
        onClick={onPick}
        className="ring-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1"
      >
        🖼 {imageUrl ? copy.blockForms.imageChange : copy.blockForms.imageSelect}
      </button>
    </div>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        id={id}
        data-testid={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
      />
    </label>
  );
}

function FormFooter({
  pending,
  error,
  saved,
  onCancel,
  onSave,
  copy,
  saveStatusCopy,
  lastSavedAt,
}: {
  pending: boolean;
  error: string | null;
  saved: boolean;
  onCancel: () => void;
  onSave: () => void;
  copy: BlockEditModalCopy;
  saveStatusCopy?: SaveStatusIndicatorCopy;
  lastSavedAt?: Date | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p data-testid="block-form-error" className="text-destructive text-xs">
          {error}
        </p>
      )}
      {saved && (
        <p
          data-testid="block-form-saved"
          className="text-xs text-emerald-600 dark:text-emerald-400"
        >
          ✓ {copy.saved}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        {/* Step 46 — save-status pill on the left, action buttons on the right. */}
        <div className="min-h-[20px]">
          {saveStatusCopy && (
            <SaveStatusIndicator
              status={pending ? 'saving' : saved ? 'saved' : 'idle'}
              lastSavedAt={lastSavedAt ?? null}
              copy={saveStatusCopy}
            />
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            data-testid="block-form-cancel"
            className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 font-mono text-xs ring-1"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            data-testid="block-form-save"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 font-mono text-xs disabled:opacity-50"
          >
            {pending ? copy.saving : copy.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function useSaveBlock(): {
  pending: boolean;
  error: string | null;
  saved: boolean;
  /**
   * Conflict state from the most recent save attempt (step 46).
   * `conflictWith` holds the server-side block the form should
   * either adopt (reload) or overwrite. `null` clears the dialog.
   */
  conflictWith: import('@/types/database').Block | null;
  /** Current expectedVersion the form pins. Increments after each
   * successful save so back-to-back edits stay in sync. */
  expectedVersion: number;
  setExpectedVersion: (n: number) => void;
  dismissConflict: () => void;
  save: (
    input: {
      pageId: string;
      blockId: string;
      newData: Record<string, unknown>;
      expectedVersion?: number;
    },
    onSuccess: () => void
  ) => void;
} {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [conflictWith, setConflictWith] = useState<import('@/types/database').Block | null>(null);
  const [expectedVersion, setExpectedVersion] = useState<number>(0);

  function save(
    input: {
      pageId: string;
      blockId: string;
      newData: Record<string, unknown>;
      expectedVersion?: number;
    },
    onSuccess: () => void
  ): void {
    setError(null);
    setSaved(false);
    setConflictWith(null);
    startTransition(async () => {
      const result = await saveBlockContentAction(input);
      if (result.success) {
        setSaved(true);
        if (typeof result.newVersion === 'number') {
          setExpectedVersion(result.newVersion);
        }
        setTimeout(onSuccess, 700);
      } else if (result.conflict && result.currentBlock) {
        // Step 46 — conflict surfaces as its own UI path; don't
        // collapse it into the generic error pill.
        setConflictWith(result.currentBlock);
      } else {
        setError(result.error ?? 'Onbekende fout');
      }
    });
  }

  return {
    pending,
    error,
    saved,
    conflictWith,
    expectedVersion,
    setExpectedVersion,
    dismissConflict: () => setConflictWith(null),
    save,
  };
}
