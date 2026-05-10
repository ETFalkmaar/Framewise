import { ChevronDown } from 'lucide-react';

import { getTranslatedString } from '@/lib/public-site/locale-fallback';
import type { FaqBlock as FaqBlockType, Locale } from '@/lib/blocks/types';

/**
 * Frequently-asked-questions block.
 *
 * Server-rendered using native `<details>` / `<summary>` elements
 * so toggling works without any JavaScript — important for SEO,
 * progressive enhancement, and for the AI agent that scrapes the
 * markup. The `<ChevronDown />` icon rotates 180° via the
 * `group-open:` Tailwind variant when the item is open.
 */
export function FaqBlock({
  block,
  locale,
  defaultLocale,
}: {
  block: FaqBlockType;
  locale: Locale;
  defaultLocale: Locale;
}): React.JSX.Element {
  const headline = getTranslatedString(block.props.headline_translations, locale, defaultLocale);

  return (
    <section data-testid={`faq-block-${block.id}`} className="w-full px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {headline && (
          <h2
            data-testid="faq-block-headline"
            className="text-display-md mb-8 text-center font-bold tracking-tight"
          >
            {headline}
          </h2>
        )}
        <ul className="space-y-3">
          {block.props.items.map((item, idx) => {
            const question = getTranslatedString(item.question_translations, locale, defaultLocale);
            const answer = getTranslatedString(item.answer_translations, locale, defaultLocale);
            return (
              <li key={`${block.id}-${idx}`}>
                <details
                  className="group border-border bg-card rounded-lg border"
                  data-testid={`faq-item-${idx}`}
                >
                  <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-medium transition-colors">
                    <span data-testid={`faq-item-question-${idx}`}>{question}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className="text-muted-foreground size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
                    />
                  </summary>
                  <div
                    className="text-muted-foreground border-border border-t px-5 py-4 text-sm leading-relaxed"
                    data-testid={`faq-item-answer-${idx}`}
                  >
                    {answer}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
