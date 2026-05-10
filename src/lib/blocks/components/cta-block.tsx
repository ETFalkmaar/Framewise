import Link from 'next/link';
import { cn } from '@/lib/utils';

import { getTranslatedString } from '@/lib/public-site/locale-fallback';
import type { CtaBlock as CtaBlockType, Locale } from '@/lib/blocks/types';

const BACKGROUND_CLASSES: Record<NonNullable<CtaBlockType['props']['background_color']>, string> = {
  primary: 'bg-primary text-primary-foreground',
  neutral: 'bg-muted text-foreground',
  accent: 'bg-accent text-accent-foreground',
};

/**
 * Button colour-on-colour: when the section background is `primary`,
 * the button should pop in a contrasting (secondary) colour. Same
 * idea for `neutral` (use primary) and `accent` (outline so the
 * accent panel stays the dominant colour).
 */
const BUTTON_CLASSES: Record<NonNullable<CtaBlockType['props']['background_color']>, string> = {
  primary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  neutral: 'bg-primary text-primary-foreground hover:bg-primary/90',
  accent: 'border border-current bg-transparent text-current hover:bg-current/10',
};

/**
 * Coloured call-to-action panel — typically rendered at the bottom of
 * a page to nudge visitors towards the booking / contact / signup
 * flow. Headline + optional subheadline + button.
 */
export function CtaBlock({
  block,
  locale,
  defaultLocale,
}: {
  block: CtaBlockType;
  locale: Locale;
  defaultLocale: Locale;
}): React.JSX.Element {
  const headline = getTranslatedString(block.props.headline_translations, locale, defaultLocale);
  const subheadline = getTranslatedString(
    block.props.subheadline_translations,
    locale,
    defaultLocale
  );
  const buttonText = getTranslatedString(
    block.props.button_text_translations,
    locale,
    defaultLocale
  );
  const variant = block.props.background_color ?? 'primary';

  return (
    <section
      data-testid={`cta-block-${block.id}`}
      className={cn('w-full px-6 py-16 sm:py-24', BACKGROUND_CLASSES[variant])}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <h2
          data-testid="cta-block-headline"
          className="text-display-md sm:text-display-lg font-bold tracking-tight"
        >
          {headline}
        </h2>
        {subheadline && (
          <p data-testid="cta-block-subheadline" className="max-w-xl text-base sm:text-lg">
            {subheadline}
          </p>
        )}
        <Link
          href={block.props.button_link}
          data-testid="cta-block-button"
          className={cn(
            'mt-2 inline-flex h-11 items-center justify-center rounded-lg px-6 text-base font-medium transition-colors',
            BUTTON_CLASSES[variant]
          )}
        >
          {buttonText}
        </Link>
      </div>
    </section>
  );
}
