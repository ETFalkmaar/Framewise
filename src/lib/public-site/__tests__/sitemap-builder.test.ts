import { beforeEach, describe, expect, it } from 'vitest';
import type { Block, Page, Tenant } from '@/types/database';

import '@/lib/data';
import { setBlocksRepo, type BlocksRepository } from '@/lib/data/repositories/blocks';
import { setPagesRepo, type PagesRepository } from '@/lib/data/repositories/pages';
import { setTenantsRepo, type TenantsRepository } from '@/lib/data/repositories/tenants';

import { mockBlocksRepo } from '@/lib/data/adapters/mock/blocks';
import { mockPagesRepo } from '@/lib/data/adapters/mock/pages';
import { mockTenantsRepo } from '@/lib/data/adapters/mock/tenants';

import { buildPageUrl, buildSitemap } from '../sitemap-builder';

const TENANT: Tenant = {
  id: 't-1',
  slug: 'demo-villa',
  name: 'Demo Villa',
  country: 'CW',
  vat_number: null,
  crib_number: null,
  subscription_plan_id: 'plan-1',
  status: 'live',
  custom_domain: null,
  default_locale: 'en',
  enabled_locales: ['en', 'nl', 'fr'],
  og_image_url: null,
  organization_type: 'LodgingBusiness',
  twitter_handle: null,
  maintenance_message_translations: null,
  maintenance_logo_url: null,
  maintenance_contact_email: null,
  publish_request_status: 'none',
  publish_requested_at: null,
  publish_requested_by_user_id: null,
  publish_approval_notes: null,
  publish_approved_at: null,
  publish_approved_by_user_id: null,
  publish_rejected_at: null,
  publish_rejected_by_user_id: null,
  bookings_enabled: false,
  booking_timezone: null,
  calendar_feed_token: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function makePage(overrides: Partial<Page>): Page {
  return {
    id: `p-${overrides.slug}`,
    tenant_id: TENANT.id,
    slug: overrides.slug ?? 'page',
    status: 'published',
    parent_id: null,
    order_index: 0,
    seo_meta: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    published_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const HOME = makePage({ slug: 'home', updated_at: '2026-04-15T00:00:00.000Z' });
const ABOUT = makePage({ slug: 'over-ons' });
const CONTACT = makePage({ slug: 'contact' });
const DRAFT = makePage({ slug: 'concept', status: 'draft' });
const ARCHIVED = makePage({ slug: 'old-news', status: 'archived' });
const NOINDEX = makePage({
  slug: 'preview',
  seo_meta: { noindex: true },
});

function setupRepos(opts: { tenants?: Tenant[]; pages?: Page[]; blocks?: Block[] }): void {
  const tenants = opts.tenants ?? [TENANT];
  const pages = opts.pages ?? [];
  const blocks = opts.blocks ?? [];

  const tenantsRepo: TenantsRepository = {
    ...mockTenantsRepo,
    async findById(id) {
      return tenants.find((t) => t.id === id) ?? null;
    },
    async findBySlug(slug) {
      return tenants.find((t) => t.slug === slug) ?? null;
    },
  };
  const pagesRepo: PagesRepository = {
    ...mockPagesRepo,
    async listByTenant(tenantId) {
      return pages.filter((p) => p.tenant_id === tenantId);
    },
    async findBySlug(tenantId, slug) {
      return pages.find((p) => p.tenant_id === tenantId && p.slug === slug) ?? null;
    },
  };
  const blocksRepo: BlocksRepository = {
    ...mockBlocksRepo,
    async findByPageId(pageId) {
      return blocks.filter((b) => b.page_id === pageId);
    },
  };
  setTenantsRepo(tenantsRepo);
  setPagesRepo(pagesRepo);
  setBlocksRepo(blocksRepo);
}

describe('buildPageUrl', () => {
  it('emits the bare base URL for the homepage in the default locale (nl)', () => {
    const url = buildPageUrl({
      baseUrl: 'https://framewise-pi.vercel.app',
      pathPrefix: '',
      pageSlug: '',
      locale: 'nl',
    });
    expect(url).toBe('https://framewise-pi.vercel.app/');
  });

  it('emits a /en prefix for non-default locales', () => {
    const url = buildPageUrl({
      baseUrl: 'https://framewise-pi.vercel.app',
      pathPrefix: '',
      pageSlug: '',
      locale: 'en',
    });
    expect(url).toBe('https://framewise-pi.vercel.app/en');
  });

  it('prepends the path prefix and slug for inner pages', () => {
    const url = buildPageUrl({
      baseUrl: 'https://framewise-pi.vercel.app',
      pathPrefix: '/sites/demo-villa',
      pageSlug: 'over-ons',
      locale: 'nl',
    });
    expect(url).toBe('https://framewise-pi.vercel.app/sites/demo-villa/over-ons');
  });

  it('puts the locale prefix before the path prefix for fr/en', () => {
    const url = buildPageUrl({
      baseUrl: 'https://framewise-pi.vercel.app',
      pathPrefix: '/sites/demo-villa',
      pageSlug: 'over-ons',
      locale: 'fr',
    });
    expect(url).toBe('https://framewise-pi.vercel.app/fr/sites/demo-villa/over-ons');
  });
});

describe('buildSitemap', () => {
  beforeEach(() => {
    setupRepos({ tenants: [], pages: [], blocks: [] });
  });

  it('returns an empty array when the tenant cannot be found', async () => {
    setupRepos({ tenants: [], pages: [HOME] });
    const result = await buildSitemap({
      tenantId: 't-missing',
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
    });
    expect(result).toEqual([]);
  });

  it('returns one entry per published page', async () => {
    setupRepos({ pages: [HOME, ABOUT, CONTACT] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
    });
    expect(result).toHaveLength(3);
  });

  it('skips draft pages', async () => {
    setupRepos({ pages: [HOME, DRAFT] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
    });
    expect(result.map((e) => e.url)).toEqual(['https://example.com/']);
  });

  it('skips archived pages', async () => {
    setupRepos({ pages: [HOME, ARCHIVED] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
    });
    expect(result.map((e) => e.url)).toEqual(['https://example.com/']);
  });

  it('skips pages with seo_meta.noindex = true', async () => {
    setupRepos({ pages: [HOME, NOINDEX] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.url).toBe('https://example.com/');
  });

  it('gives the homepage priority 1.0 and changeFrequency daily', async () => {
    setupRepos({ pages: [HOME] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
    });
    expect(result[0]?.priority).toBe(1.0);
    expect(result[0]?.changeFrequency).toBe('daily');
  });

  it('gives inner pages priority 0.8 and changeFrequency weekly', async () => {
    setupRepos({ pages: [ABOUT] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
    });
    expect(result[0]?.priority).toBe(0.8);
    expect(result[0]?.changeFrequency).toBe('weekly');
  });

  it('uses the page updated_at timestamp as lastModified', async () => {
    setupRepos({ pages: [HOME] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
    });
    expect(result[0]?.lastModified).toBeInstanceOf(Date);
    expect((result[0]?.lastModified as Date).toISOString()).toBe('2026-04-15T00:00:00.000Z');
  });

  it('emits hreflang alternates for every enabled locale', async () => {
    setupRepos({ pages: [HOME] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
    });
    const langs = result[0]?.alternates?.languages as Record<string, string>;
    expect(Object.keys(langs).sort()).toEqual(['en-US', 'fr-FR', 'nl-NL']);
  });

  it('homepage default-locale URL is the bare path with no slug suffix', async () => {
    setupRepos({ pages: [HOME] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
      pathPrefix: '/sites/demo-villa',
    });
    expect(result[0]?.url).toBe('https://example.com/sites/demo-villa');
  });

  it('inner-page URL includes both the path prefix and the slug', async () => {
    setupRepos({ pages: [ABOUT] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
      pathPrefix: '/sites/demo-villa',
    });
    expect(result[0]?.url).toBe('https://example.com/sites/demo-villa/over-ons');
  });

  it('alternates.languages keys use BCP-47 hyphenated tags', async () => {
    setupRepos({ pages: [ABOUT] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
      pathPrefix: '/sites/demo-villa',
    });
    const langs = result[0]?.alternates?.languages as Record<string, string>;
    expect(langs['nl-NL']).toBe('https://example.com/sites/demo-villa/over-ons');
    expect(langs['fr-FR']).toBe('https://example.com/fr/sites/demo-villa/over-ons');
    expect(langs['en-US']).toBe('https://example.com/en/sites/demo-villa/over-ons');
  });

  it('returns an empty array when the tenant has no pages', async () => {
    setupRepos({ pages: [] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com',
      allLocales: ['nl', 'fr', 'en'],
    });
    expect(result).toEqual([]);
  });

  it('strips a trailing slash on the base URL before composing entries', async () => {
    setupRepos({ pages: [HOME] });
    const result = await buildSitemap({
      tenantId: TENANT.id,
      baseUrl: 'https://example.com/',
      allLocales: ['nl', 'fr', 'en'],
    });
    expect(result[0]?.url).toBe('https://example.com/');
  });
});
