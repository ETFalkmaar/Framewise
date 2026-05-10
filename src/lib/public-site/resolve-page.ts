import { blocksRepo, pagesRepo, tenantsRepo } from '@/lib/data';
import type { Block, Page, Tenant } from '@/types/database';

import { isKnownBlockType } from '@/lib/blocks/registry';
import type {
  ContactFormField,
  ContentBlock,
  GalleryImage,
  FaqItem,
  Locale,
  PricingPlan,
  RawBlockData,
} from '@/lib/blocks/types';
import { VALID_CONTACT_FORM_FIELDS } from '@/lib/blocks/types';

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
    case 'gallery': {
      const images = parseGalleryImages(data.images);
      if (images.length === 0) return null;
      return {
        ...base,
        type: 'gallery',
        props: {
          images,
          layout: optionalGalleryLayout(data.layout),
          columns: optionalGalleryColumns(data.columns),
        },
      };
    }
    case 'faq': {
      const items = parseFaqItems(data.items);
      if (items.length === 0) return null;
      return {
        ...base,
        type: 'faq',
        props: {
          headline_translations: optionalStringMap(data.headline_translations),
          items,
        },
      };
    }
    case 'pricing': {
      const plans = parsePricingPlans(data.plans);
      if (plans.length === 0) return null;
      return {
        ...base,
        type: 'pricing',
        props: {
          headline_translations: optionalStringMap(data.headline_translations),
          subheadline_translations: optionalStringMap(data.subheadline_translations),
          plans,
        },
      };
    }
    case 'contact': {
      if (!isStringMap(data.submit_text_translations)) return null;
      if (!isStringMap(data.success_message_translations)) return null;
      const fields = parseContactFields(data.fields);
      return {
        ...base,
        type: 'contact',
        props: {
          headline_translations: optionalStringMap(data.headline_translations),
          subheadline_translations: optionalStringMap(data.subheadline_translations),
          fields,
          submit_text_translations: data.submit_text_translations,
          success_message_translations: data.success_message_translations,
          recipient_email: optionalString(data.recipient_email),
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

/**
 * Parse a `gallery.images` array. Drops entries with missing `url`
 * or `alt_translations` — defensive: we'd rather render a smaller
 * gallery than crash. An empty array bubbles up as a `null` block
 * which the resolver then filters out.
 */
function parseGalleryImages(value: unknown): GalleryImage[] {
  if (!Array.isArray(value)) return [];
  const out: GalleryImage[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.url !== 'string' || item.url.length === 0) continue;
    if (!isStringMap(item.alt_translations)) continue;
    out.push({
      url: item.url,
      alt_translations: item.alt_translations,
      caption_translations: optionalStringMap(item.caption_translations),
    });
  }
  return out;
}

/**
 * Parse a `faq.items` array. Each entry needs both
 * `question_translations` and `answer_translations`; partial rows
 * are dropped.
 */
function parseFaqItems(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];
  const out: FaqItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (!isStringMap(item.question_translations)) continue;
    if (!isStringMap(item.answer_translations)) continue;
    out.push({
      question_translations: item.question_translations,
      answer_translations: item.answer_translations,
    });
  }
  return out;
}

/**
 * Parse a `pricing.plans` array. Each plan needs an `id`, a
 * non-empty `name_translations`, a `price` string, and an array of
 * feature translations. Plans missing any of these are dropped.
 */
function parsePricingPlans(value: unknown): PricingPlan[] {
  if (!Array.isArray(value)) return [];
  const out: PricingPlan[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const plan = raw as Record<string, unknown>;
    if (typeof plan.id !== 'string' || plan.id.length === 0) continue;
    if (!isStringMap(plan.name_translations)) continue;
    if (typeof plan.price !== 'string' || plan.price.length === 0) continue;
    if (!Array.isArray(plan.features_translations)) continue;
    const features: PricingPlan['features_translations'] = [];
    for (const feature of plan.features_translations) {
      if (isStringMap(feature)) features.push(feature);
    }
    out.push({
      id: plan.id,
      name_translations: plan.name_translations,
      price: plan.price,
      features_translations: features,
      cta_text_translations: optionalStringMap(plan.cta_text_translations),
      cta_link: optionalString(plan.cta_link),
      highlight: plan.highlight === true,
    });
  }
  return out;
}

/**
 * Parse a `contact.fields` array. Drops unknown values, dedupes
 * (the form layout uses array order so duplicates would render the
 * same field twice). Empty result is allowed — a contact form with
 * just a submit button is still legal.
 */
function parseContactFields(value: unknown): ContactFormField[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<ContactFormField>(VALID_CONTACT_FORM_FIELDS);
  const seen = new Set<ContactFormField>();
  const out: ContactFormField[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    if (!valid.has(raw as ContactFormField)) continue;
    const field = raw as ContactFormField;
    if (seen.has(field)) continue;
    seen.add(field);
    out.push(field);
  }
  return out;
}

function optionalGalleryLayout(value: unknown): 'grid' | 'carousel' | 'masonry' | undefined {
  return value === 'grid' || value === 'carousel' || value === 'masonry' ? value : undefined;
}

function optionalGalleryColumns(value: unknown): 2 | 3 | 4 | undefined {
  return value === 2 || value === 3 || value === 4 ? value : undefined;
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
