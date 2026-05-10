import Link from 'next/link';
import { Check } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { getTranslatedString } from '@/lib/public-site/locale-fallback';
import type { Locale, PricingBlock as PricingBlockType, PricingPlan } from '@/lib/blocks/types';

const POPULAR_LABEL: Record<Locale, string> = {
  nl: 'Populair',
  fr: 'Populaire',
  en: 'Popular',
};

/**
 * Pricing comparison block. Renders headline + subheadline + a grid
 * of plan cards. Up to ~3 plans render comfortably side by side; 4+
 * wrap onto two rows.
 *
 * One plan can be `highlight: true` to surface it visually — gets a
 * primary-coloured ring, a `scale-105` boost, and a "Popular" badge
 * in the active locale.
 */
export function PricingBlock({
  block,
  locale,
  defaultLocale,
}: {
  block: PricingBlockType;
  locale: Locale;
  defaultLocale: Locale;
}): React.JSX.Element {
  const headline = getTranslatedString(block.props.headline_translations, locale, defaultLocale);
  const subheadline = getTranslatedString(
    block.props.subheadline_translations,
    locale,
    defaultLocale
  );

  return (
    <section data-testid={`pricing-block-${block.id}`} className="w-full px-6 py-16">
      <div className="mx-auto max-w-7xl">
        {(headline || subheadline) && (
          <header className="mb-12 text-center">
            {headline && (
              <h2
                data-testid="pricing-block-headline"
                className="text-display-md sm:text-display-lg font-bold tracking-tight"
              >
                {headline}
              </h2>
            )}
            {subheadline && (
              <p className="text-muted-foreground mt-3 text-base sm:text-lg">{subheadline}</p>
            )}
          </header>
        )}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {block.props.plans.map((plan) => (
            <PricingPlanCard
              key={plan.id}
              plan={plan}
              locale={locale}
              defaultLocale={defaultLocale}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingPlanCard({
  plan,
  locale,
  defaultLocale,
}: {
  plan: PricingPlan;
  locale: Locale;
  defaultLocale: Locale;
}) {
  const planName = getTranslatedString(plan.name_translations, locale, defaultLocale);
  const ctaText = getTranslatedString(plan.cta_text_translations, locale, defaultLocale);
  const isHighlight = plan.highlight === true;

  return (
    <Card
      size="sm"
      data-testid={`pricing-plan-${plan.id}`}
      data-pricing-highlight={isHighlight ? 'true' : 'false'}
      className={cn(
        'relative flex h-full flex-col',
        isHighlight && 'ring-primary scale-100 ring-2 md:scale-105'
      )}
    >
      {isHighlight && (
        <Badge
          variant="secondary"
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 font-mono"
        >
          {POPULAR_LABEL[locale] ?? POPULAR_LABEL[defaultLocale] ?? POPULAR_LABEL.en}
        </Badge>
      )}
      <CardHeader>
        <CardTitle className="text-lg">{planName}</CardTitle>
        <p className="text-display-md mt-2 font-bold tracking-tight">{plan.price}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-2">
        <ul className="flex-1 space-y-2 text-sm">
          {plan.features_translations.map((feature, idx) => (
            <li
              key={`${plan.id}-feat-${idx}`}
              className="flex items-start gap-2"
              data-testid={`pricing-plan-${plan.id}-feature-${idx}`}
            >
              <Check aria-hidden="true" className="text-primary mt-0.5 size-4 shrink-0" />
              <span>{getTranslatedString(feature, locale, defaultLocale)}</span>
            </li>
          ))}
        </ul>
        {ctaText && plan.cta_link && (
          <Link
            href={plan.cta_link}
            data-testid={`pricing-plan-${plan.id}-cta`}
            className={cn(
              'mt-2 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors',
              isHighlight
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-border bg-background hover:bg-muted border'
            )}
          >
            {ctaText}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
