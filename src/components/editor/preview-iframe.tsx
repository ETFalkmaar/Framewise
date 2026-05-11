'use client';

import { useEffect, useRef, useState } from 'react';

import type { Block } from '@/types/database';

import { updatePreviewDraft } from '@/app/(i18n)/[locale]/(auth-required)/account/site/pages/[pageId]/edit/preview-actions';

export interface PreviewIframeCopy {
  title: string;
  loading: string;
  deviceDesktopAria: string;
  deviceMobileAria: string;
  errorTitle: string;
  draftWaiting: string;
}

export interface PreviewIframeProps {
  pageId: string;
  /** Tenant slug — used to build the iframe URL `/sites/<slug>...`. */
  siteSlug: string;
  /**
   * Trailing path part for the iframe URL. `''` for the homepage,
   * `/about` (with leading slash) for inner pages. The component
   * doesn't validate — caller passes whatever the page slug requires.
   */
  pagePath: string;
  /**
   * Current draft block list (from the editor's optimistic state).
   * Effect pushes this to the cookie on a 500ms debounce and then
   * reloads the iframe.
   */
  draftBlocks: Block[];
  /** Locale to render the iframe in — matches the editor's locale. */
  locale: string;
  enabled?: boolean;
  copy: PreviewIframeCopy;
}

type DeviceMode = 'desktop' | 'mobile';

/**
 * Live-preview iframe for the block editor (step 45 — fase 12
 * part 7/8). Renders alongside the editor; whenever `draftBlocks`
 * changes, the component:
 *
 *   1. Debounces the change for 500ms (typing-friendly).
 *   2. Pushes the optimistic block list to the per-page preview
 *      cookie via the `updatePreviewDraft` server action.
 *   3. Bumps a `v=` counter on the iframe URL, forcing a reload so
 *      the public route picks up the new cookie state.
 *
 * The iframe URL itself points at the existing public-site route
 * with `?preview=true&pageId=<id>` — that route reads the cookie
 * and substitutes the draft blocks when an authenticated editor is
 * on the requesting tenant. Anonymous visitors hitting the same URL
 * see the published version, so the cookie is not a data-leak risk.
 */
export function PreviewIframe({
  pageId,
  siteSlug,
  pagePath,
  draftBlocks,
  locale,
  enabled = true,
  copy,
}: PreviewIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [reloadKey, setReloadKey] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Whenever the draft changes, debounce → push to cookie → reload iframe.
  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(async () => {
      setLastError(null);
      const result = await updatePreviewDraft({ pageId, blocks: draftBlocks });
      if (!result.success) {
        setLastError(result.error ?? copy.errorTitle);
        return;
      }
      setIsLoading(true);
      setReloadKey((k) => k + 1);
    }, 500);

    return () => clearTimeout(timer);
  }, [draftBlocks, pageId, enabled, copy.errorTitle]);

  if (!enabled) return null;

  const previewUrl =
    `/${locale}/sites/${siteSlug}${pagePath}` + `?preview=true&pageId=${pageId}&v=${reloadKey}`;
  const iframeClassName =
    device === 'mobile'
      ? 'w-[375px] h-full mx-auto block border border-border bg-background shadow-sm'
      : 'w-full h-full bg-background';

  return (
    <div
      data-testid="preview-iframe"
      className="bg-muted/30 border-border flex h-full flex-col border-l"
    >
      <div className="bg-background border-border flex items-center justify-between border-b p-2">
        <span className="text-sm font-medium" data-testid="preview-title">
          {copy.title}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setDevice('desktop')}
            className={`rounded px-2 py-1 text-sm transition ${
              device === 'desktop' ? 'bg-muted' : 'hover:bg-muted/60'
            }`}
            data-testid="preview-desktop"
            aria-pressed={device === 'desktop'}
            aria-label={copy.deviceDesktopAria}
          >
            <span aria-hidden>🖥️</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice('mobile')}
            className={`rounded px-2 py-1 text-sm transition ${
              device === 'mobile' ? 'bg-muted' : 'hover:bg-muted/60'
            }`}
            data-testid="preview-mobile"
            aria-pressed={device === 'mobile'}
            aria-label={copy.deviceMobileAria}
          >
            <span aria-hidden>📱</span>
          </button>
        </div>
      </div>
      {lastError && (
        <div
          className="bg-destructive/10 text-destructive p-2 text-xs"
          data-testid="preview-error"
          role="alert"
        >
          {lastError}
        </div>
      )}
      <div className="bg-muted/20 relative flex-1 overflow-auto p-2">
        {isLoading && (
          <div
            className="text-muted-foreground bg-background/90 absolute top-2 right-3 z-10 rounded px-2 py-1 text-[10px]"
            data-testid="preview-loading"
            aria-live="polite"
          >
            {copy.loading}
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={previewUrl}
          className={iframeClassName}
          onLoad={() => setIsLoading(false)}
          data-testid="preview-frame"
          title={copy.title}
          style={{ minHeight: device === 'mobile' ? '600px' : '100%' }}
        />
      </div>
    </div>
  );
}
