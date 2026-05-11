'use client';

import { useState } from 'react';

import type { Block, LocaleCode, Media } from '@/types/database';

import { PreviewIframe, type PreviewIframeCopy } from './preview-iframe';
import { SortableBlockList } from './sortable-block-list';
import type { BlockEditModalProps } from './block-edit-modal';
import type { SortableBlockListProps } from './sortable-block-list';

export interface EditPageLayoutCopy {
  togglePreviewShow: string;
  togglePreviewHide: string;
  preview: PreviewIframeCopy;
}

export interface EditPageLayoutProps {
  pageId: string;
  siteSlug: string;
  pagePath: string;
  locale: LocaleCode;
  blocks: Block[];
  canEdit: boolean;
  mediaLibrary: Media[];
  copy: EditPageLayoutCopy;
  blockListCopy: SortableBlockListProps['copy'];
  modalCopy: BlockEditModalProps['copy'];
  initialPreviewVisible?: boolean;
  /** Server-rendered editor header (back link, title, drag instructions). */
  header: React.ReactNode;
  /** Server-rendered block count + add-block section. */
  blockCountSection: React.ReactNode;
}

/**
 * Client wrapper for the editor page that owns:
 *  - the optimistic block list (`draftBlocks`) shared between
 *    SortableBlockList and PreviewIframe
 *  - the show/hide preview toggle
 *
 * Server `page.tsx` passes initial data + i18n copy + the already-
 * rendered header/section nodes (those depend on `getTranslations`
 * which we can't call from a client component). Step 45 — fase 12
 * part 7/8.
 */
export function EditPageLayout({
  pageId,
  siteSlug,
  pagePath,
  locale,
  blocks,
  canEdit,
  mediaLibrary,
  copy,
  blockListCopy,
  modalCopy,
  initialPreviewVisible = true,
  header,
  blockCountSection,
}: EditPageLayoutProps) {
  const [showPreview, setShowPreview] = useState(initialPreviewVisible);
  const [draftBlocks, setDraftBlocks] = useState<Block[]>(blocks);

  return (
    <div
      data-testid="edit-page-layout"
      data-preview-visible={showPreview ? 'true' : 'false'}
      className="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden"
    >
      <div
        className={`flex flex-col overflow-y-auto px-6 py-12 lg:py-16 ${
          showPreview ? 'lg:w-1/2' : 'w-full'
        }`}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col">
          {header}
          <button
            type="button"
            data-testid="toggle-preview"
            onClick={() => setShowPreview((v) => !v)}
            className="ring-border bg-background hover:bg-muted mt-3 inline-flex w-fit items-center gap-1 rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition"
          >
            {showPreview ? copy.togglePreviewHide : copy.togglePreviewShow}
          </button>

          <div className="mt-6">{blockCountSection}</div>

          <SortableBlockList
            pageId={pageId}
            blocks={blocks}
            canEdit={canEdit}
            locale={locale}
            mediaLibrary={mediaLibrary}
            copy={blockListCopy}
            modalCopy={modalCopy}
            onBlocksChange={setDraftBlocks}
          />
        </div>
      </div>

      {showPreview && (
        <div className="h-[60vh] lg:h-screen lg:w-1/2" data-testid="preview-pane">
          <PreviewIframe
            pageId={pageId}
            siteSlug={siteSlug}
            pagePath={pagePath}
            draftBlocks={draftBlocks}
            locale={locale}
            enabled={showPreview}
            copy={copy.preview}
          />
        </div>
      )}
    </div>
  );
}
