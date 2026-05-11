'use client';

import { useEffect, useState, useTransition } from 'react';

import type { Block, BlockType, LocaleCode, Media } from '@/types/database';

import { saveBlockContentAction } from '@/app/(i18n)/[locale]/(auth-required)/account/site/pages/[pageId]/edit/actions';

import { ImagePicker } from './image-picker';
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
}

export interface BlockEditModalProps {
  block: Block;
  pageId: string;
  locale: LocaleCode;
  mediaLibrary: Media[];
  open: boolean;
  onClose: () => void;
  copy: BlockEditModalCopy;
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
}: {
  block: Block;
  pageId: string;
  locale: LocaleCode;
  mediaLibrary: Media[];
  onClose: () => void;
  copy: BlockEditModalCopy;
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
}

interface FormWithMediaProps extends FormProps {
  mediaLibrary: Media[];
}

function TextBlockForm({ block, pageId, locale, onClose, copy }: FormProps) {
  const initialTranslations =
    (block.data.content_translations as Record<string, string> | undefined) ?? {};
  const initialContent = initialTranslations[locale] ?? initialTranslations.nl ?? '';

  const [content, setContent] = useState<string>(initialContent);
  const { pending, error, saved, save } = useSaveBlock();

  return (
    <div data-testid="text-block-form" className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">
          {copy.blockForms.textContent} ({locale.toUpperCase()})
        </span>
        <div className="mt-1">
          <TipTapEditor
            id="text-content"
            initialContent={initialContent}
            onChange={setContent}
            copy={copy.tiptap}
          />
        </div>
      </label>

      <FormFooter
        pending={pending}
        error={error}
        saved={saved}
        onCancel={onClose}
        onSave={() =>
          save(
            {
              pageId,
              blockId: block.id,
              newData: {
                content_translations: { ...initialTranslations, [locale]: content },
              },
            },
            onClose
          )
        }
        copy={copy}
      />
    </div>
  );
}

function HeroBlockForm({ block, pageId, locale, mediaLibrary, onClose, copy }: FormWithMediaProps) {
  const initial = block.data as Record<string, unknown>;
  const headlineTranslations =
    (initial.headline_translations as Record<string, string> | undefined) ?? {};
  const subheadlineTranslations =
    (initial.subheadline_translations as Record<string, string> | undefined) ?? {};
  const ctaTextTranslations =
    (initial.cta_text_translations as Record<string, string> | undefined) ?? {};

  const [headline, setHeadline] = useState<string>(headlineTranslations[locale] ?? '');
  const [subheadline, setSubheadline] = useState<string>(subheadlineTranslations[locale] ?? '');
  const [ctaText, setCtaText] = useState<string>(ctaTextTranslations[locale] ?? '');
  const [ctaLink, setCtaLink] = useState<string>((initial.cta_link as string) ?? '');
  const [overlay, setOverlay] = useState<string>((initial.background_overlay as string) ?? 'dark');
  const [imageUrl, setImageUrl] = useState<string>((initial.image_url as string) ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);

  const { pending, error, saved, save } = useSaveBlock();

  return (
    <div data-testid="hero-block-form" className="space-y-4">
      <ImagePreviewAndPicker imageUrl={imageUrl} onPick={() => setPickerOpen(true)} copy={copy} />
      <TextInput
        id="hero-title"
        label={`${copy.blockForms.heroTitle} (${locale.toUpperCase()})`}
        value={headline}
        onChange={setHeadline}
      />
      <TextInput
        id="hero-subtitle"
        label={`${copy.blockForms.heroSubtitle} (${locale.toUpperCase()})`}
        value={subheadline}
        onChange={setSubheadline}
      />
      <TextInput
        id="hero-cta-text"
        label={`${copy.blockForms.heroCtaText} (${locale.toUpperCase()})`}
        value={ctaText}
        onChange={setCtaText}
      />
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
        onSave={() =>
          save(
            {
              pageId,
              blockId: block.id,
              newData: {
                headline_translations: { ...headlineTranslations, [locale]: headline },
                subheadline_translations: { ...subheadlineTranslations, [locale]: subheadline },
                cta_text_translations: { ...ctaTextTranslations, [locale]: ctaText },
                cta_link: ctaLink,
                background_overlay: overlay,
                image_url: imageUrl,
              },
            },
            onClose
          )
        }
        copy={copy}
      />
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
}: FormWithMediaProps) {
  const initial = block.data as Record<string, unknown>;
  const altTranslations = (initial.alt_translations as Record<string, string> | undefined) ?? {};
  const captionTranslations =
    (initial.caption_translations as Record<string, string> | undefined) ?? {};

  const [imageUrl, setImageUrl] = useState<string>((initial.image_url as string) ?? '');
  const [altText, setAltText] = useState<string>(altTranslations[locale] ?? '');
  const [caption, setCaption] = useState<string>(captionTranslations[locale] ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);

  const { pending, error, saved, save } = useSaveBlock();

  return (
    <div data-testid="image-block-form" className="space-y-4">
      <ImagePreviewAndPicker imageUrl={imageUrl} onPick={() => setPickerOpen(true)} copy={copy} />
      <TextInput
        id="image-alt"
        label={`${copy.blockForms.imageAlt} (${locale.toUpperCase()})`}
        value={altText}
        onChange={setAltText}
      />
      <TextInput
        id="image-caption"
        label={`${copy.blockForms.imageCaption} (${locale.toUpperCase()})`}
        value={caption}
        onChange={setCaption}
      />

      <FormFooter
        pending={pending}
        error={error}
        saved={saved}
        onCancel={onClose}
        onSave={() =>
          save(
            {
              pageId,
              blockId: block.id,
              newData: {
                image_url: imageUrl,
                alt_translations: { ...altTranslations, [locale]: altText },
                caption_translations: { ...captionTranslations, [locale]: caption },
              },
            },
            onClose
          )
        }
        copy={copy}
      />

      {pickerOpen && (
        <ImagePicker
          initial={mediaLibrary}
          onClose={() => setPickerOpen(false)}
          onSelect={(url, alt) => {
            setImageUrl(url);
            if (alt && !altText) setAltText(alt);
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
}: {
  pending: boolean;
  error: string | null;
  saved: boolean;
  onCancel: () => void;
  onSave: () => void;
  copy: BlockEditModalCopy;
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
      <div className="flex justify-end gap-2">
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
  );
}

function useSaveBlock(): {
  pending: boolean;
  error: string | null;
  saved: boolean;
  save: (
    input: { pageId: string; blockId: string; newData: Record<string, unknown> },
    onSuccess: () => void
  ) => void;
} {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save(
    input: { pageId: string; blockId: string; newData: Record<string, unknown> },
    onSuccess: () => void
  ): void {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveBlockContentAction(input);
      if (result.success) {
        setSaved(true);
        setTimeout(onSuccess, 700);
      } else {
        setError(result.error ?? 'Onbekende fout');
      }
    });
  }

  return { pending, error, saved, save };
}
