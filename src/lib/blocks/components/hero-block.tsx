import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import { getTranslatedString } from '@/lib/public-site/locale-fallback';
import type { HeroBlock as HeroBlockType, Locale } from '@/lib/blocks/types';
import { IMAGE_SIZES, getBlurDataUrl } from '@/lib/perf/image-helpers';

const OVERLAY_CLASSES: Record<NonNullable<HeroBlockType['props']['background_overlay']>, string> = {
  none: '',
  light: 'bg-white/30',
  dark: 'bg-black/50',
};

/**
 * Full-bleed hero with optional background image, dark/light overlay,
 * headline + subheadline + CTA. Always at least 60vh — the eye-catcher
 * at the top of every public page.
 */
export function HeroBlock({
  block,
  locale,
  defaultLocale,
}: {
  block: HeroBlockType;
  locale: Locale;
  defaultLocale: Locale;
}): React.JSX.Element {
  const headline = getTranslatedString(block.props.headline_translations, locale, defaultLocale);
  const subheadline = getTranslatedString(
    block.props.subheadline_translations,
    locale,
    defaultLocale
  );
  const ctaText = getTranslatedString(block.props.cta_text_translations, locale, defaultLocale);
  const overlay = OVERLAY_CLASSES[block.props.background_overlay ?? 'dark'];
  const hasImage = Boolean(block.props.image_url);
  const blurDataURL = block.props.image_url ? getBlurDataUrl(block.props.image_url) : undefined;

  return (
    <section
      data-testid={`hero-block-${block.id}`}
      className="relative flex min-h-[60vh] w-full items-center justify-center overflow-hidden text-white"
    >
      {hasImage && (
        <Image
          src={block.props.image_url!}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes={IMAGE_SIZES.HERO_FULL}
          className="object-cover"
          {...(blurDataURL ? { placeholder: 'blur' as const, blurDataURL } : {})}
        />
      )}
      {hasImage && overlay && (
        <div aria-hidden="true" className={cn('absolute inset-0', overlay)} />
      )}
      {!hasImage && (
        <div
          aria-hidden="true"
          className="from-primary/40 to-background absolute inset-0 bg-gradient-to-br"
        />
      )}
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-24 text-center">
        <h1
          data-testid="hero-block-headline"
          className="text-display-xl sm:text-display-2xl font-bold tracking-tight drop-shadow"
        >
          {headline}
        </h1>
        {subheadline && (
          <p
            data-testid="hero-block-subheadline"
            className="max-w-xl text-base font-medium text-white/90 drop-shadow sm:text-lg"
          >
            {subheadline}
          </p>
        )}
        {ctaText && block.props.cta_link && (
          <Link
            href={block.props.cta_link}
            data-testid="hero-block-cta"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 inline-flex h-11 items-center justify-center rounded-lg px-6 text-base font-medium transition-colors"
          >
            {ctaText}
          </Link>
        )}
      </div>
    </section>
  );
}
