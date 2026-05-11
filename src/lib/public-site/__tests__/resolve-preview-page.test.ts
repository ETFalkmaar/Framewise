import { beforeEach, describe, expect, it } from 'vitest';
import type { Block, Page, Tenant } from '@/types/database';

import '@/lib/data';

import { setBlocksRepo, type BlocksRepository } from '@/lib/data/repositories/blocks';
import { setPagesRepo, type PagesRepository } from '@/lib/data/repositories/pages';
import { setTenantsRepo, type TenantsRepository } from '@/lib/data/repositories/tenants';

import { resolvePreviewPage } from '@/lib/public-site/resolve-page';
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
  og_image_url: null,
  organization_type: null,
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
    ai_agent_enabled: false,
    ai_agent_id: null,
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
  seo_meta: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  published_at: '2026-01-01T00:00:00.000Z',
};

const DRAFT_PAGE: Page = {
  ...HOME_PAGE,
  id: 'p-draft',
  slug: 'about',
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
    version: 1,
  };
}

const TEXT_PERSISTED = makeBlock('b-persisted', HOME_PAGE.id, 'text', 0, {
  content_translations: { nl: 'Persisted content', en: 'Persisted content' },
});

const TEXT_DRAFT = makeBlock('b-draft', HOME_PAGE.id, 'text', 0, {
  content_translations: { nl: 'Draft content', en: 'Draft content' },
});

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

describe('resolvePreviewPage', () => {
  beforeEach(() => {
    setTenantsRepo(mockTenantsRepo);
    setPagesRepo(mockPagesRepo);
    setBlocksRepo(mockBlocksRepo);
  });

  it('returns ResolvedPage for a published page (parity with resolvePage)', async () => {
    setupRepos({ tenants: [TENANT], pages: [HOME_PAGE], blocks: [TEXT_PERSISTED] });

    const result = await resolvePreviewPage({
      tenantId: TENANT.id,
      pageSlug: '',
      locale: 'nl',
      draftBlocks: null,
    });

    expect(result).not.toBeNull();
    expect(result?.page.id).toBe(HOME_PAGE.id);
    expect(result?.blocks).toHaveLength(1);
    expect(result?.blocks[0].type).toBe('text');
  });

  it('renders draft-status pages — unlike resolvePage which gates on published', async () => {
    setupRepos({
      tenants: [TENANT],
      pages: [DRAFT_PAGE],
      blocks: [makeBlock('b-d1', DRAFT_PAGE.id, 'text', 0, TEXT_PERSISTED.data)],
    });

    const result = await resolvePreviewPage({
      tenantId: TENANT.id,
      pageSlug: 'about',
      locale: 'nl',
      draftBlocks: null,
    });

    expect(result).not.toBeNull();
    expect(result?.page.status).toBe('draft');
    expect(result?.blocks).toHaveLength(1);
  });

  it('substitutes draftBlocks for the persisted block rows when provided', async () => {
    setupRepos({ tenants: [TENANT], pages: [HOME_PAGE], blocks: [TEXT_PERSISTED] });

    const result = await resolvePreviewPage({
      tenantId: TENANT.id,
      pageSlug: '',
      locale: 'nl',
      draftBlocks: [TEXT_DRAFT],
    });

    expect(result).not.toBeNull();
    expect(result?.blocks).toHaveLength(1);
    // Draft content, not persisted content.
    if (result?.blocks[0].type === 'text') {
      expect(result.blocks[0].props.content_translations.nl).toBe('Draft content');
    }
  });

  it('falls back to persisted blocks when draftBlocks is null', async () => {
    setupRepos({ tenants: [TENANT], pages: [HOME_PAGE], blocks: [TEXT_PERSISTED] });

    const result = await resolvePreviewPage({
      tenantId: TENANT.id,
      pageSlug: '',
      locale: 'nl',
      draftBlocks: null,
    });

    if (result?.blocks[0].type === 'text') {
      expect(result.blocks[0].props.content_translations.nl).toBe('Persisted content');
    }
  });

  it('returns null when the tenant does not exist', async () => {
    setupRepos({ tenants: [], pages: [HOME_PAGE], blocks: [] });

    const result = await resolvePreviewPage({
      tenantId: 'nonexistent',
      pageSlug: '',
      locale: 'nl',
      draftBlocks: null,
    });

    expect(result).toBeNull();
  });

  it('returns null when no page matches the slug', async () => {
    setupRepos({ tenants: [TENANT], pages: [], blocks: [] });

    const result = await resolvePreviewPage({
      tenantId: TENANT.id,
      pageSlug: '',
      locale: 'nl',
      draftBlocks: null,
    });

    expect(result).toBeNull();
  });

  it('maps empty pageSlug to "home" so the iframe URL works for the homepage', async () => {
    setupRepos({ tenants: [TENANT], pages: [HOME_PAGE], blocks: [TEXT_PERSISTED] });

    const result = await resolvePreviewPage({
      tenantId: TENANT.id,
      pageSlug: '',
      locale: 'nl',
      draftBlocks: null,
    });

    expect(result?.page.slug).toBe('home');
  });

  it('drops draft blocks that fail mapping — defensive, never crashes the preview', async () => {
    setupRepos({ tenants: [TENANT], pages: [HOME_PAGE], blocks: [TEXT_PERSISTED] });

    const brokenDraft = makeBlock('b-broken', HOME_PAGE.id, 'text', 0, {
      // Missing content_translations -> toContentBlock returns null
    });

    const result = await resolvePreviewPage({
      tenantId: TENANT.id,
      pageSlug: '',
      locale: 'nl',
      draftBlocks: [brokenDraft, TEXT_DRAFT],
    });

    expect(result?.blocks).toHaveLength(1);
    expect(result?.blocks[0].id).toBe(TEXT_DRAFT.id);
  });
});
