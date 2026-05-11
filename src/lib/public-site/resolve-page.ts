import { blocksRepo, pagesRepo, tenantsRepo } from '@/lib/data';
import type { Block, Page, Tenant } from '@/types/database';

import type { ContentBlock, Locale } from '@/lib/blocks/types';

import { toContentBlock } from './block-mapper';

export interface ResolvedPage {
  tenant: Tenant;
  page: Page;
  blocks: ContentBlock[];
  /**
   * The locale that was requested. Block components do their own
   * fallback through `defaultLocale` (see `locale-fallback.ts`).
   */
  locale: Locale;
  /** `tenant.default_locale` — used by block components for fallback. */
  defaultLocale: Locale;
}

export interface ResolvePageInput {
  tenantId: string;
  /** `''` is treated as the homepage (slug = `home`). */
  pageSlug: string;
  locale: Locale;
}

/**
 * Resolve a tenant + page + blocks bundle for the public renderer.
 *
 * Returns `null` when:
 *  - the tenant doesn't exist
 *  - no page matches the slug
 *  - the page exists but isn't `published`
 *
 * The empty slug (`''`) is mapped to `home` because that's the
 * convention in the seed data and the existing tenant has a `home`
 * page row. A future migration may switch to "actual empty string"
 * — when that happens this single line is the only place to
 * change.
 */
export async function resolvePage(input: ResolvePageInput): Promise<ResolvedPage | null> {
  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return null;

  const slug = input.pageSlug === '' ? 'home' : input.pageSlug;
  const page = await pagesRepo.findBySlug(tenant.id, slug);
  if (!page) return null;
  if (page.status !== 'published') return null;

  const rawBlocks = await blocksRepo.findByPageId(page.id);
  const blocks = rawBlocks.map(toContentBlock).filter((b): b is ContentBlock => b !== null);

  return {
    tenant,
    page,
    blocks,
    locale: input.locale,
    defaultLocale: tenant.default_locale as Locale,
  };
}

export interface ResolvePreviewPageInput {
  tenantId: string;
  pageSlug: string;
  locale: Locale;
  /**
   * Draft blocks pulled from the preview cookie (step 45). When
   * provided, these replace the persisted `blocksRepo.findByPageId`
   * result so the customer can see uncommitted edits in the iframe.
   * Pass `null` to fall back to persisted blocks (e.g. cookie expired
   * or never set).
   */
  draftBlocks: Block[] | null;
}

/**
 * Preview variant of `resolvePage` (step 45 — fase 12 part 7/8):
 *
 *  1. Drops the `status === 'published'` gate so draft pages still
 *     render in the preview iframe.
 *  2. Substitutes the cookie-supplied `draftBlocks` for the
 *     persisted block rows when present, so the iframe reflects
 *     uncommitted changes.
 *
 * Caller (the public-site route file) is responsible for the auth
 * + `canEditBlocks` check BEFORE calling this — once you call it,
 * draft data may flow into the response. Public visitors hitting
 * `?preview=true` without auth go through `resolvePage` instead,
 * so no draft data leaks.
 */
export async function resolvePreviewPage(
  input: ResolvePreviewPageInput
): Promise<ResolvedPage | null> {
  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return null;

  const slug = input.pageSlug === '' ? 'home' : input.pageSlug;
  const page = await pagesRepo.findBySlug(tenant.id, slug);
  if (!page) return null;

  const rawBlocks = input.draftBlocks ?? (await blocksRepo.findByPageId(page.id));
  const blocks = rawBlocks.map(toContentBlock).filter((b): b is ContentBlock => b !== null);

  return {
    tenant,
    page,
    blocks,
    locale: input.locale,
    defaultLocale: tenant.default_locale as Locale,
  };
}
