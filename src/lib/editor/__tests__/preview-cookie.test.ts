import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Block } from '@/types/database';

// Mock the next/headers `cookies()` API with an in-memory store.
// `vi.hoisted` so the cookie store reference is shared between the
// module-level vi.mock factory and the test cases.
interface CookieOptions {
  name: string;
  value: string;
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none' | boolean;
  maxAge?: number;
  path?: string;
}

const cookieStore = vi.hoisted(() => {
  const map = new Map<string, string>();
  return {
    map,
    get: vi.fn((name: string) => {
      const value = map.get(name);
      return value === undefined ? undefined : { name, value };
    }),
    set: vi.fn((options: { name: string; value: string }) => {
      map.set(options.name, options.value);
    }),
    delete: vi.fn((name: string) => {
      map.delete(name);
    }),
  } as {
    map: Map<string, string>;
    get: (name: string) => { name: string; value: string } | undefined;
    set: (options: CookieOptions) => void;
    delete: (name: string) => void;
  } & {
    set: { mock: { calls: [CookieOptions][] }; mockClear: () => void };
    get: { mockClear: () => void };
    delete: { mockClear: () => void };
  };
});

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieStore),
}));

// Import AFTER vi.mock so the mocked cookies() is bound.
import {
  clearPreviewDraft,
  getPreviewDraft,
  previewCookieName,
  setPreviewDraft,
} from '@/lib/editor/preview-cookie';

function makeBlock(id: string, page_id: string, data: Record<string, unknown> = {}): Block {
  return {
    id,
    page_id,
    block_type: 'text',
    order_index: 0,
    data,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    version: 1,
  };
}

const PAGE_ID = 'page-abc';
const COOKIE_NAME = previewCookieName(PAGE_ID);

describe('preview-cookie', () => {
  beforeEach(() => {
    cookieStore.map.clear();
    cookieStore.get.mockClear();
    cookieStore.set.mockClear();
    cookieStore.delete.mockClear();
  });

  it('setPreviewDraft writes the draft to the page-scoped cookie', async () => {
    const blocks = [makeBlock('b-1', PAGE_ID, { content_translations: { nl: 'Hello' } })];
    await setPreviewDraft({ pageId: PAGE_ID, blocks, updatedAt: 1700000000000 });

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const args = cookieStore.set.mock.calls[0][0];
    expect(args.name).toBe(COOKIE_NAME);
    expect(args.sameSite).toBe('lax');
    expect(args.httpOnly).toBe(false);
    expect(args.maxAge).toBe(60 * 60);
    expect(args.path).toBe('/');

    // Round-trip the value
    const parsed = JSON.parse(args.value);
    expect(parsed.pageId).toBe(PAGE_ID);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.updatedAt).toBe(1700000000000);
  });

  it('getPreviewDraft round-trips the same blocks that were written', async () => {
    const blocks = [
      makeBlock('b-a', PAGE_ID, { content_translations: { nl: 'A' } }),
      makeBlock('b-b', PAGE_ID, { content_translations: { nl: 'B' } }),
    ];
    await setPreviewDraft({ pageId: PAGE_ID, blocks, updatedAt: 42 });

    const draft = await getPreviewDraft(PAGE_ID);
    expect(draft).not.toBeNull();
    expect(draft?.pageId).toBe(PAGE_ID);
    expect(draft?.blocks).toHaveLength(2);
    expect(draft?.blocks[0].id).toBe('b-a');
    expect(draft?.updatedAt).toBe(42);
  });

  it('getPreviewDraft returns null when no cookie is set for that page', async () => {
    const draft = await getPreviewDraft('page-without-draft');
    expect(draft).toBeNull();
  });

  it('getPreviewDraft returns null when the cookie value is malformed JSON', async () => {
    cookieStore.map.set(COOKIE_NAME, '{not-json');

    const draft = await getPreviewDraft(PAGE_ID);
    expect(draft).toBeNull();
  });

  it('getPreviewDraft returns null when the cookie pageId mismatches the requested pageId', async () => {
    // Stale cookie from another page leaked into this slot — refuse it
    // so the iframe falls back to persisted blocks rather than rendering
    // the wrong page's draft.
    cookieStore.map.set(
      COOKIE_NAME,
      JSON.stringify({ pageId: 'OTHER-page', blocks: [], updatedAt: 1 })
    );

    const draft = await getPreviewDraft(PAGE_ID);
    expect(draft).toBeNull();
  });

  it('getPreviewDraft returns null when the cookie blocks field is not an array', async () => {
    cookieStore.map.set(
      COOKIE_NAME,
      JSON.stringify({ pageId: PAGE_ID, blocks: 'not-an-array', updatedAt: 1 })
    );

    const draft = await getPreviewDraft(PAGE_ID);
    expect(draft).toBeNull();
  });

  it('clearPreviewDraft removes the per-page cookie', async () => {
    await setPreviewDraft({ pageId: PAGE_ID, blocks: [], updatedAt: 1 });
    expect(cookieStore.map.has(COOKIE_NAME)).toBe(true);

    await clearPreviewDraft(PAGE_ID);
    expect(cookieStore.map.has(COOKIE_NAME)).toBe(false);
    expect(cookieStore.delete).toHaveBeenCalledWith(COOKIE_NAME);
  });

  it('previewCookieName produces the framewise_preview_<pageId> format', () => {
    expect(previewCookieName('abc-123')).toBe('framewise_preview_abc-123');
  });

  it('cookies for different pages do not collide', async () => {
    await setPreviewDraft({ pageId: 'page-1', blocks: [], updatedAt: 1 });
    await setPreviewDraft({ pageId: 'page-2', blocks: [], updatedAt: 2 });

    const d1 = await getPreviewDraft('page-1');
    const d2 = await getPreviewDraft('page-2');

    expect(d1?.updatedAt).toBe(1);
    expect(d2?.updatedAt).toBe(2);
  });
});
