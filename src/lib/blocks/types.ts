/**
 * Block types for the public website renderer (step 24+).
 *
 * Discriminated union on `type` so the renderer registry can map
 * each block to a typed component without `any`. Each block carries:
 *  - the framework identity fields (`id`, `position`)
 *  - a typed `props` payload that mirrors what the database stores
 *    in `block.data` (we re-export `block.data` as `props` because
 *    "props" reads more naturally inside JSX components).
 *
 * Schema note: the `Block` row in `@/types/database` uses `data` and
 * `block_type`; the public renderer normalises that into the shape
 * here. See `resolve-page.ts` for the conversion.
 *
 * Step 24 shipped 4 base blocks (hero/text/image/cta); step 25 adds
 * the remaining 4 (gallery/faq/pricing/contact). All 8 block types
 * declared in `database.ts` now have a typed renderer.
 * Unknown types are still skipped gracefully by the registry — this
 * keeps the door open for future migrations to add more types
 * without crashing partially-migrated databases.
 */

export type Locale = 'nl' | 'fr' | 'en';

/** A `{ locale → string }` map. All locales optional — see locale-fallback.ts. */
export type LocaleStringMap = Partial<Record<Locale, string>>;

export interface BlockBase {
  id: string;
  /** Mirror of `block.order_index` from the DB; rendered top-to-bottom. */
  position: number;
}

/** Full-screen hero with optional background image, headline + sub + CTA. */
export interface HeroBlock extends BlockBase {
  type: 'hero';
  props: {
    headline_translations: LocaleStringMap;
    subheadline_translations?: LocaleStringMap;
    image_url?: string;
    cta_text_translations?: LocaleStringMap;
    cta_link?: string;
    /** `none` | `light` | `dark`. */
    background_overlay?: 'none' | 'light' | 'dark';
  };
}

/** Body text. Rendered as a `prose` article. */
export interface TextBlock extends BlockBase {
  type: 'text';
  props: {
    content_translations: LocaleStringMap;
    alignment?: 'left' | 'center' | 'right';
  };
}

/** Single image with caption + alt text. Optional full-bleed. */
export interface ImageBlock extends BlockBase {
  type: 'image';
  props: {
    image_url: string;
    alt_translations: LocaleStringMap;
    caption_translations?: LocaleStringMap;
    full_width?: boolean;
  };
}

/** Coloured panel with headline + subheadline + button. */
export interface CtaBlock extends BlockBase {
  type: 'cta';
  props: {
    headline_translations: LocaleStringMap;
    subheadline_translations?: LocaleStringMap;
    button_text_translations: LocaleStringMap;
    button_link: string;
    background_color?: 'primary' | 'neutral' | 'accent';
  };
}

/**
 * One image inside a `gallery` block. `caption_translations` is
 * optional; `alt_translations` is required because empty alt text
 * is an accessibility regression.
 */
export interface GalleryImage {
  url: string;
  alt_translations: LocaleStringMap;
  caption_translations?: LocaleStringMap;
}

/**
 * Multi-image gallery. Three layouts share the same data shape:
 *  - `grid` (default): even responsive grid, aspect-square cells
 *  - `carousel`: horizontal scroll-snap row
 *  - `masonry`: CSS-columns with natural aspect ratios
 */
export interface GalleryBlock extends BlockBase {
  type: 'gallery';
  props: {
    images: GalleryImage[];
    /** Default `grid`. */
    layout?: 'grid' | 'carousel' | 'masonry';
    /** Default `3`. Only used by the `grid` layout. */
    columns?: 2 | 3 | 4;
  };
}

/**
 * One Q&A row inside a `faq` block.
 */
export interface FaqItem {
  question_translations: LocaleStringMap;
  answer_translations: LocaleStringMap;
}

/**
 * Frequently-asked-questions block. Server-rendered as native
 * `<details>` so toggling works without JavaScript.
 */
export interface FaqBlock extends BlockBase {
  type: 'faq';
  props: {
    headline_translations?: LocaleStringMap;
    items: FaqItem[];
  };
}

/**
 * One plan card inside a `pricing` block. `price` is a free-form
 * string so providers can format it however they want
 * (`"€99/mo"`, `"$1,500"`, `"From €15/user/mo"`, …).
 *
 * `features_translations` is an array of locale-maps — each entry
 * resolves to a translated string and renders as one bullet.
 */
export interface PricingPlan {
  /** Unique within the block — used for `data-testid="pricing-plan-<id>"`. */
  id: string;
  name_translations: LocaleStringMap;
  price: string;
  features_translations: LocaleStringMap[];
  cta_text_translations?: LocaleStringMap;
  cta_link?: string;
  /** Visually highlight one plan with a `Populair` / `Popular` badge. */
  highlight?: boolean;
}

/**
 * Pricing comparison block. Up to ~3 plans render comfortably side
 * by side; more start to wrap onto two rows.
 */
export interface PricingBlock extends BlockBase {
  type: 'pricing';
  props: {
    headline_translations?: LocaleStringMap;
    subheadline_translations?: LocaleStringMap;
    plans: PricingPlan[];
  };
}

/** Set of optional contact-form fields. Order in the array = render order. */
export type ContactFormField = 'name' | 'email' | 'phone' | 'subject' | 'message';

/**
 * Contact form. `email` is always required when present; the
 * client component enforces this. `recipient_email` is mock-only
 * for now — real mail submission lands in step 54 via Resend.
 */
export interface ContactBlock extends BlockBase {
  type: 'contact';
  props: {
    headline_translations?: LocaleStringMap;
    subheadline_translations?: LocaleStringMap;
    /** Render order. Empty array → form has only the submit button. */
    fields: ContactFormField[];
    submit_text_translations: LocaleStringMap;
    success_message_translations: LocaleStringMap;
    /** Stored on the connection but not used yet (step 54). */
    recipient_email?: string;
  };
}

export type ContentBlock =
  | HeroBlock
  | TextBlock
  | ImageBlock
  | CtaBlock
  | GalleryBlock
  | FaqBlock
  | PricingBlock
  | ContactBlock;

export type BlockType = ContentBlock['type'];

/** Sorted list of every block type the public renderer can render. */
export const KNOWN_BLOCK_TYPES: BlockType[] = [
  'hero',
  'text',
  'image',
  'cta',
  'gallery',
  'faq',
  'pricing',
  'contact',
];

/** Valid options for `ContactBlock.props.fields`. */
export const VALID_CONTACT_FORM_FIELDS: ContactFormField[] = [
  'name',
  'email',
  'phone',
  'subject',
  'message',
];

/** Generic shape used by the `data` column on the DB. */
export type RawBlockData = Record<string, unknown>;
