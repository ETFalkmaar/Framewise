import { blocksRepo, pagesRepo, tenantsRepo } from '@/lib/data';
import type { Block, Page, Tenant } from '@/types/database';

import { isKnownBlockType } from '@/lib/blocks/registry';
import type { ContentBlock, Locale, RawBlockData } from '@/lib/blocks/types';

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

/**
 * Normalise a database `Block` row into a typed `ContentBlock` for
 * the renderer. Returns `null` for:
 *  - unknown block types (gallery / faq / pricing / contact ship in
 *    step 25 — until then the registry skips them)
 *  - rows whose `data` payload is missing required fields for the
 *    declared type (defensive: we'd rather drop one block than
 *    crash the whole page)
 *
 * The mapping is deliberately defensive — we don't trust the
 * database schema to enforce JSON shapes. Tests cover each happy
 * path + missing-required-field rejection.
 */
function toContentBlock(row: Block): ContentBlock | null {
  if (!isKnownBlockType(row.block_type)) return null;
  const data = row.data as RawBlockData;
  const base = { id: row.id, position: row.order_index };

  switch (row.block_type) {
    case 'hero': {
      if (!isStringMap(data.headline_translations)) return null;
      return {
        ...base,
        type: 'hero',
        props: {
          headline_translations: data.headline_translations,
          subheadline_translations: optionalStringMap(data.subheadline_translations),
          image_url: optionalString(data.image_url),
          cta_text_translations: optionalStringMap(data.cta_text_translations),
          cta_link: optionalString(data.cta_link),
          background_overlay: optionalOverlay(data.background_overlay),
        },
      };
    }
    case 'text': {
      if (!isStringMap(data.content_translations)) return null;
      return {
        ...base,
        type: 'text',
        props: {
          content_translations: data.content_translations,
          alignment: optionalAlignment(data.alignment),
        },
      };
    }
    case 'image': {
      if (typeof data.image_url !== 'string' || data.image_url.length === 0) return null;
      if (!isStringMap(data.alt_translations)) return null;
      return {
        ...base,
        type: 'image',
        props: {
          image_url: data.image_url,
          alt_translations: data.alt_translations,
          caption_translations: optionalStringMap(data.caption_translations),
          full_width: data.full_width === true,
        },
      };
    }
    case 'cta': {
      if (!isStringMap(data.headline_translations)) return null;
      if (!isStringMap(data.button_text_translations)) return null;
      if (typeof data.button_link !== 'string' || data.button_link.length === 0) return null;
      return {
        ...base,
        type: 'cta',
        props: {
          headline_translations: data.headline_translations,
          subheadline_translations: optionalStringMap(data.subheadline_translations),
          button_text_translations: data.button_text_translations,
          button_link: data.button_link,
          background_color: optionalBackgroundColor(data.background_color),
        },
      };
    }
    default:
      // Future block types — the registry's `isKnownBlockType` already
      // filters these out, so this branch is unreachable. Kept for
      // exhaustiveness.
      return null;
  }
}

const VALID_LOCALES = new Set<Locale>(['nl', 'fr', 'en']);

function isStringMap(value: unknown): value is Partial<Record<Locale, string>> {
  if (!value || typeof value !== 'object') return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return false;
  return entries.every(([k, v]) => VALID_LOCALES.has(k as Locale) && typeof v === 'string');
}

function optionalStringMap(value: unknown): Partial<Record<Locale, string>> | undefined {
  return isStringMap(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalOverlay(value: unknown): 'none' | 'light' | 'dark' | undefined {
  return value === 'none' || value === 'light' || value === 'dark' ? value : undefined;
}

function optionalAlignment(value: unknown): 'left' | 'center' | 'right' | undefined {
  return value === 'left' || value === 'center' || value === 'right' ? value : undefined;
}

function optionalBackgroundColor(value: unknown): 'primary' | 'neutral' | 'accent' | undefined {
  return value === 'primary' || value === 'neutral' || value === 'accent' ? value : undefined;
}
