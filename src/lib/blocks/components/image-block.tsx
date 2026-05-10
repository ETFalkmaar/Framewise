import Image from 'next/image';
import { cn } from '@/lib/utils';

import { getTranslatedString } from '@/lib/public-site/locale-fallback';
import type { ImageBlock as ImageBlockType, Locale } from '@/lib/blocks/types';

/**
 * Single image block. Caption optional. Set `full_width: true` for a
 * bleed-to-edge hero-adjacent image; `false` keeps it inside the
 * standard content container.
 *
 * Uses `next/image` with `sizes` matched to the layout so the CDN
 * serves an appropriately-sized variant.
 */
export function ImageBlock({
  block,
  locale,
  defaultLocale,
}: {
  block: ImageBlockType;
  locale: Locale;
  defaultLocale: Locale;
}): React.JSX.Element {
  const alt = getTranslatedString(block.props.alt_translations, locale, defaultLocale);
  const caption = getTranslatedString(block.props.caption_translations, locale, defaultLocale);
  const fullWidth = block.props.full_width === true;

  return (
    <section
      data-testid={`image-block-${block.id}`}
      className={cn('w-full px-6 py-8', fullWidth ? 'sm:px-0' : '')}
    >
      <figure className={cn('mx-auto', fullWidth ? 'max-w-7xl' : 'max-w-3xl')}>
        <div
          className={cn(
            'relative aspect-[3/2] w-full overflow-hidden',
            fullWidth ? 'rounded-none sm:rounded-lg' : 'rounded-lg'
          )}
        >
          <Image
            src={block.props.image_url}
            alt={alt}
            fill
            sizes={fullWidth ? '100vw' : '(max-width: 768px) 100vw, 768px'}
            className="object-cover"
            data-testid="image-block-img"
          />
        </div>
        {caption && (
          <figcaption
            className="text-muted-foreground mt-3 text-center text-sm"
            data-testid="image-block-caption"
          >
            {caption}
          </figcaption>
        )}
      </figure>
    </section>
  );
}
