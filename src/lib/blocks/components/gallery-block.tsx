import Image from 'next/image';
import { cn } from '@/lib/utils';

import { getTranslatedString } from '@/lib/public-site/locale-fallback';
import type { GalleryBlock as GalleryBlockType, Locale } from '@/lib/blocks/types';

const GRID_COLUMN_CLASSES: Record<NonNullable<GalleryBlockType['props']['columns']>, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
};

const MASONRY_COLUMN_CLASSES: Record<NonNullable<GalleryBlockType['props']['columns']>, string> = {
  2: 'columns-1 sm:columns-2',
  3: 'columns-2 md:columns-3',
  4: 'columns-2 md:columns-3 lg:columns-4',
};

/**
 * Multi-image gallery. Three layouts share the same data shape:
 *
 *  - `grid` (default): even responsive grid with aspect-square
 *    cells. Use for matching photo sets.
 *  - `carousel`: horizontal scroll-snap row, swipeable on touch.
 *    Use when image count > 6 or images vary in importance.
 *  - `masonry`: CSS columns layout — natural aspect ratios stacked
 *    in a Pinterest-style grid. Use for editorial / mood-board
 *    galleries.
 *
 * Captions render on hover (desktop) or always (touch). Alt text
 * always renders for screen readers via the `alt` attribute on
 * `next/image`.
 */
export function GalleryBlock({
  block,
  locale,
  defaultLocale,
}: {
  block: GalleryBlockType;
  locale: Locale;
  defaultLocale: Locale;
}): React.JSX.Element {
  const layout = block.props.layout ?? 'grid';
  const columns = block.props.columns ?? 3;

  if (block.props.images.length === 0) {
    return (
      <section
        data-testid={`gallery-block-${block.id}`}
        data-gallery-layout={layout}
        className="text-muted-foreground w-full px-6 py-12 text-center text-sm italic"
      >
        Empty gallery.
      </section>
    );
  }

  if (layout === 'carousel') {
    return (
      <section
        data-testid={`gallery-block-${block.id}`}
        data-gallery-layout="carousel"
        className="w-full py-12"
      >
        <div className="snap-x snap-mandatory overflow-x-auto px-6">
          <div className="flex gap-4">
            {block.props.images.map((img, idx) => (
              <GalleryImage
                key={`${block.id}-${idx}`}
                src={img.url}
                alt={getTranslatedString(img.alt_translations, locale, defaultLocale)}
                caption={getTranslatedString(img.caption_translations, locale, defaultLocale)}
                priority={false}
                className="aspect-[4/3] w-72 shrink-0 snap-start sm:w-96"
                sizes="(max-width: 640px) 18rem, 24rem"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (layout === 'masonry') {
    return (
      <section
        data-testid={`gallery-block-${block.id}`}
        data-gallery-layout="masonry"
        className="w-full px-6 py-16"
      >
        <div className={cn('mx-auto max-w-7xl gap-4', MASONRY_COLUMN_CLASSES[columns])}>
          {block.props.images.map((img, idx) => (
            <div key={`${block.id}-${idx}`} className="mb-4 break-inside-avoid">
              <GalleryImage
                src={img.url}
                alt={getTranslatedString(img.alt_translations, locale, defaultLocale)}
                caption={getTranslatedString(img.caption_translations, locale, defaultLocale)}
                priority={false}
                className="aspect-auto w-full"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Default: grid layout.
  return (
    <section
      data-testid={`gallery-block-${block.id}`}
      data-gallery-layout="grid"
      className="w-full px-6 py-16"
    >
      <div className={cn('mx-auto grid max-w-7xl gap-4', GRID_COLUMN_CLASSES[columns])}>
        {block.props.images.map((img, idx) => (
          <GalleryImage
            key={`${block.id}-${idx}`}
            src={img.url}
            alt={getTranslatedString(img.alt_translations, locale, defaultLocale)}
            caption={getTranslatedString(img.caption_translations, locale, defaultLocale)}
            priority={false}
            className="aspect-square w-full"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ))}
      </div>
    </section>
  );
}

function GalleryImage({
  src,
  alt,
  caption,
  className,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  caption: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <figure className={cn('group relative overflow-hidden rounded-lg', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      {caption && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 text-sm text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
