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
 * Step 24 ships only 4 of the 8 declared block types in
 * `database.ts`; gallery / faq / pricing / contact land in step 25.
 * Unknown types are skipped gracefully by the registry.
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

export type ContentBlock = HeroBlock | TextBlock | ImageBlock | CtaBlock;
export type BlockType = ContentBlock['type'];

/** Sorted list of all block types this step ships. */
export const KNOWN_BLOCK_TYPES: BlockType[] = ['hero', 'text', 'image', 'cta'];

/** Generic shape used by the `data` column on the DB. */
export type RawBlockData = Record<string, unknown>;
