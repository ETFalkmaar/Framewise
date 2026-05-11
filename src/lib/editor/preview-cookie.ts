import { cookies } from 'next/headers';

import type { Block } from '@/types/database';

/**
 * Draft state for the live-preview iframe (step 45 — fase 12
 * part 7/8). The editor pushes the optimistic block list here
 * every ~500ms via `updatePreviewDraft`, and the preview public
 * route reads it back through `getPreviewDraft`.
 *
 * The cookie is scoped per-page (`framewise_preview_<pageId>`) so
 * two editor tabs on different pages don't collide. It's
 * `httpOnly: false` so the SortableBlockList client can compare its
 * local optimistic state against the last-pushed draft if needed —
 * the auth check on the public route is the security boundary, not
 * the cookie scope.
 */
export interface PreviewDraft {
  pageId: string;
  blocks: Block[];
  /** Unix ms — used by the iframe to ignore stale pushes. */
  updatedAt: number;
}

const COOKIE_PREFIX = 'framewise_preview_';
/** 1 hour — preview drafts are short-lived; the editor refreshes them every save. */
const COOKIE_MAX_AGE = 60 * 60;

export function previewCookieName(pageId: string): string {
  return `${COOKIE_PREFIX}${pageId}`;
}

export async function setPreviewDraft(draft: PreviewDraft): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: previewCookieName(draft.pageId),
    value: JSON.stringify(draft),
    httpOnly: false,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function getPreviewDraft(pageId: string): Promise<PreviewDraft | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(previewCookieName(pageId))?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.pageId !== 'string' || obj.pageId !== pageId) return null;
    if (!Array.isArray(obj.blocks)) return null;
    if (typeof obj.updatedAt !== 'number') return null;

    return {
      pageId: obj.pageId,
      blocks: obj.blocks as Block[],
      updatedAt: obj.updatedAt,
    };
  } catch {
    // Malformed cookie value (manual edit / truncation / encoding glitch).
    // Treat it as no draft so the iframe falls back to persisted blocks.
    return null;
  }
}

export async function clearPreviewDraft(pageId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(previewCookieName(pageId));
}
