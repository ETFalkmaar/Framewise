import { beforeEach, describe, expect, it } from 'vitest';
import type { Block, Page, Tenant } from '@/types/database';

// Import the framework barrel once to wire the mock adapters before
// the test-local stubs override them.
import '@/lib/data';

import { setBlocksRepo, type BlocksRepository } from '@/lib/data/repositories/blocks';
import { setPagesRepo, type PagesRepository } from '@/lib/data/repositories/pages';
import { setTenantsRepo, type TenantsRepository } from '@/lib/data/repositories/tenants';

import { resolvePage } from '@/lib/public-site/resolve-page';
import { mockBlocksRepo } from '@/lib/data/adapters/mock/blocks';
import { mockPagesRepo } from '@/lib/data/adapters/mock/pages';
import { mockTenantsRepo } from '@/lib/data/adapters/mock/tenants';

const TENANT: Tenant = {
  id: 't-1',
  slug: 'demo',
  name: 'Demo Tenant',
  country: 'NL',
  vat_number: null,
  crib_number: null,
  subscription_plan_id: 'plan-1',
  status: 'live',
  custom_domain: null,
  default_locale: 'nl',
  enabled_locales: ['nl', 'en'],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const HOME_PAGE: Page = {
  id: 'p-home',
  tenant_id: TENANT.id,
  slug: 'home',
  status: 'published',
  parent_id: null,
  order_index: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  published_at: '2026-01-01T00:00:00.000Z',
};

const DRAFT_PAGE: Page = {
  ...HOME_PAGE,
  id: 'p-draft',
  slug: 'draft',
  status: 'draft',
  published_at: null,
};

function makeBlock(
  id: string,
  page_id: string,
  block_type: Block['block_type'],
  order_index: number,
  data: Record<string, unknown>
): Block {
  return {
    id,
    page_id,
    block_type,
    order_index,
    data,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

const VALID_HERO_DATA = {
  headline_translations: { nl: 'Hallo', en: 'Hello' },
  subheadline_translations: { nl: 'Welkom', en: 'Welcome' },
  background_overlay: 'dark',
};

const VALID_TEXT_DATA = {
  content_translations: { nl: 'Inhoud', en: 'Content' },
  alignment: 'left',
};

/**
 * Build a fresh stubbed repo trio with the given tenants / pages /
 * blocks, then wire them into the framework via `setX`.
 *
 * Resets the global `tenantsRepo` etc. at the end of each test via
 * `beforeEach`.
 */
function setupRepos(input: { tenants?: Tenant[]; pages?: Page[]; blocks?: Block[] }): void {
  const tenants = input.tenants ?? [];
  const pages = input.pages ?? [];
  const blocks = input.blocks ?? [];

  const tenantsImpl: TenantsRepository = {
    ...mockTenantsRepo,
    findById: async (id) => tenants.find((t) => t.id === id) ?? null,
    findBySlug: async (slug) => tenants.find((t) => t.slug === slug) ?? null,
    list: async () => tenants,
  };

  const pagesImpl: PagesRepository = {
    ...mockPagesRepo,
    findById: async (id) => pages.find((p) => p.id === id) ?? null,
    findBySlug: async (tenantId, slug) =>
      pages.find((p) => p.tenant_id === tenantId && p.slug === slug) ?? null,
    listByTenant: async (tenantId) => pages.filter((p) => p.tenant_id === tenantId),
  };

  const blocksImpl: BlocksRepository = {
    ...mockBlocksRepo,
    findByPageId: async (pageId) =>
      blocks.filter((b) => b.page_id === pageId).sort((a, b) => a.order_index - b.order_index),
  };

  setTenantsRepo(tenantsImpl);
  setPagesRepo(pagesImpl);
  setBlocksRepo(blocksImpl);
}

describe('resolvePage', () => {
  beforeEach(() => {
    // Reset to the real mock implementations (loaded from JSON seeds)
    // before each test sets up its own stubs. The mock adapters are
    // pure functions over the in-memory `store` so this is safe.
    setTenantsRepo(mockTenantsRepo);
    setPagesRepo(mockPagesRepo);
    setBlocksRepo(mockBlocksRepo);
  });

  it('returns ResolvedPage for a published page with valid blocks', async () => {
    setupRepos({
      tenants: [TENANT],
      pages: [HOME_PAGE],
      blocks: [
        makeBlock('b1', HOME_PAGE.id, 'hero', 0, VALID_HERO_DATA),
        makeBlock('b2', HOME_PAGE.id, 'text', 1, VALID_TEXT_DATA),
      ],
    });

    const result = await resolvePage({
      tenantId: TENANT.id,
      pageSlug: 'home',
      locale: 'en',
    });

    expect(result).not.toBeNull();
    expect(result!.tenant.id).toBe(TENANT.id);
    expect(result!.page.slug).toBe('home');
    expect(result!.locale).toBe('en');
    expect(result!.defaultLocale).toBe('nl');
    expect(result!.blocks).toHaveLength(2);
    expect(result!.blocks[0]?.type).toBe('hero');
    expect(result!.blocks[1]?.type).toBe('text');
  });

  it('treats an empty page slug as the homepage (slug = "home")', async () => {
    setupRepos({ tenants: [TENANT], pages: [HOME_PAGE], blocks: [] });
    const result = await resolvePage({
      tenantId: TENANT.id,
      pageSlug: '',
      locale: 'en',
    });
    expect(result?.page.slug).toBe('home');
  });

  it('returns null for an unknown tenant id', async () => {
    setupRepos({ tenants: [TENANT], pages: [HOME_PAGE], blocks: [] });
    const result = await resolvePage({
      tenantId: 'does-not-exist',
      pageSlug: 'home',
      locale: 'en',
    });
    expect(result).toBeNull();
  });

  it('returns null for an unknown slug', async () => {
    setupRepos({ tenants: [TENANT], pages: [HOME_PAGE], blocks: [] });
    const result = await resolvePage({
      tenantId: TENANT.id,
      pageSlug: 'totally-made-up',
      locale: 'en',
    });
    expect(result).toBeNull();
  });

  it('returns null for a draft page (status filter)', async () => {
    setupRepos({ tenants: [TENANT], pages: [DRAFT_PAGE], blocks: [] });
    const result = await resolvePage({
      tenantId: TENANT.id,
      pageSlug: 'draft',
      locale: 'en',
    });
    expect(result).toBeNull();
  });

  it('returns ResolvedPage with blocks=[] when page has no blocks', async () => {
    setupRepos({ tenants: [TENANT], pages: [HOME_PAGE], blocks: [] });
    const result = await resolvePage({
      tenantId: TENANT.id,
      pageSlug: 'home',
      locale: 'en',
    });
    expect(result).not.toBeNull();
    expect(result!.blocks).toEqual([]);
  });

  it('sorts blocks by order_index even when seed inserts them out of order', async () => {
    setupRepos({
      tenants: [TENANT],
      pages: [HOME_PAGE],
      blocks: [
        makeBlock('b3', HOME_PAGE.id, 'hero', 2, VALID_HERO_DATA),
        makeBlock('b1', HOME_PAGE.id, 'hero', 0, VALID_HERO_DATA),
        makeBlock('b2', HOME_PAGE.id, 'text', 1, VALID_TEXT_DATA),
      ],
    });
    const result = await resolvePage({
      tenantId: TENANT.id,
      pageSlug: 'home',
      locale: 'en',
    });
    expect(result!.blocks.map((b) => b.position)).toEqual([0, 1, 2]);
    expect(result!.blocks.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('skips unknown block types (gallery / faq / etc — step 25 placeholders)', async () => {
    setupRepos({
      tenants: [TENANT],
      pages: [HOME_PAGE],
      blocks: [
        makeBlock('b1', HOME_PAGE.id, 'hero', 0, VALID_HERO_DATA),
        makeBlock('b2', HOME_PAGE.id, 'gallery', 1, { images: [] }),
        makeBlock('b3', HOME_PAGE.id, 'text', 2, VALID_TEXT_DATA),
      ],
    });
    const result = await resolvePage({
      tenantId: TENANT.id,
      pageSlug: 'home',
      locale: 'en',
    });
    expect(result!.blocks).toHaveLength(2);
    expect(result!.blocks.map((b) => b.type)).toEqual(['hero', 'text']);
  });

  it('skips blocks whose data is missing the required fields for their type', async () => {
    setupRepos({
      tenants: [TENANT],
      pages: [HOME_PAGE],
      blocks: [
        // Hero with no headline_translations — should be dropped.
        makeBlock('b1', HOME_PAGE.id, 'hero', 0, { image_url: 'foo.jpg' }),
        // Image without image_url — should be dropped.
        makeBlock('b2', HOME_PAGE.id, 'image', 1, {
          alt_translations: { nl: 'alt' },
        }),
        // Valid text — should land.
        makeBlock('b3', HOME_PAGE.id, 'text', 2, VALID_TEXT_DATA),
      ],
    });
    const result = await resolvePage({
      tenantId: TENANT.id,
      pageSlug: 'home',
      locale: 'en',
    });
    expect(result!.blocks).toHaveLength(1);
    expect(result!.blocks[0]?.type).toBe('text');
  });

  it('threads tenant.default_locale into the result', async () => {
    setupRepos({
      tenants: [{ ...TENANT, default_locale: 'fr', enabled_locales: ['fr', 'nl'] }],
      pages: [HOME_PAGE],
      blocks: [],
    });
    const result = await resolvePage({
      tenantId: TENANT.id,
      pageSlug: 'home',
      locale: 'nl',
    });
    expect(result!.defaultLocale).toBe('fr');
  });
});
