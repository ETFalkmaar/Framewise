import { ContactBlock as ContactComponent } from './components/contact-block';
import { CtaBlock as CtaComponent } from './components/cta-block';
import { FaqBlock as FaqComponent } from './components/faq-block';
import { GalleryBlock as GalleryComponent } from './components/gallery-block';
import { HeroBlock as HeroComponent } from './components/hero-block';
import { ImageBlock as ImageComponent } from './components/image-block';
import { PricingBlock as PricingComponent } from './components/pricing-block';
import { TextBlock as TextComponent } from './components/text-block';
import { KNOWN_BLOCK_TYPES, type BlockType, type ContentBlock, type Locale } from './types';

/**
 * Component shape every block in the registry conforms to.
 *
 * `defaultLocale` is the tenant's default locale (read from
 * `tenant.default_locale`). Used by `getTranslatedString` for the
 * fallback chain when the requested locale is missing a translation.
 */
type BlockComponentProps<T extends ContentBlock = ContentBlock> = {
  block: T;
  locale: Locale;
  defaultLocale: Locale;
};

type BlockComponent = React.ComponentType<BlockComponentProps>;

/**
 * Static registry of block components. Adding a new block type
 * means: declare it in `types.ts`, add to `KNOWN_BLOCK_TYPES`, add
 * the component here. Step 24 shipped 4 base blocks; step 25
 * completes the set with gallery / faq / pricing / contact.
 *
 * The cast through `as BlockComponent` is safe because each
 * component's `block` prop is a discriminated subtype — the registry
 * lookup happens by `block.type` so the right component always sees
 * the right discriminant.
 */
const registry: Record<BlockType, BlockComponent> = {
  hero: HeroComponent as BlockComponent,
  text: TextComponent as BlockComponent,
  image: ImageComponent as BlockComponent,
  cta: CtaComponent as BlockComponent,
  gallery: GalleryComponent as BlockComponent,
  faq: FaqComponent as BlockComponent,
  pricing: PricingComponent as BlockComponent,
  contact: ContactComponent as BlockComponent,
};

/**
 * Look up the React component for a block type. Returns `null` for
 * unknown / future block types so the renderer can skip them
 * gracefully (no crash for partially-migrated databases).
 */
export function getBlockComponent(type: string): BlockComponent | null {
  if (!isKnownBlockType(type)) return null;
  return registry[type];
}

/** Type guard: narrows `string` to `BlockType` for known types only. */
export function isKnownBlockType(type: string): type is BlockType {
  return (KNOWN_BLOCK_TYPES as readonly string[]).includes(type);
}

/**
 * Render a single block to a React node. Returns `null` for unknown
 * block types so callers can safely `.map(renderBlock)` without
 * runtime crashes — useful when the database has block types from a
 * future schema we haven't shipped yet.
 */
export function renderBlock(
  block: ContentBlock,
  locale: Locale,
  defaultLocale: Locale
): React.ReactNode {
  const Component = getBlockComponent(block.type);
  if (!Component) return null;
  return <Component block={block} locale={locale} defaultLocale={defaultLocale} />;
}

export { KNOWN_BLOCK_TYPES };
