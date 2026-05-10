import { cn } from '@/lib/utils';

import { getTranslatedString } from '@/lib/public-site/locale-fallback';
import type { Locale, TextBlock as TextBlockType } from '@/lib/blocks/types';

const ALIGNMENT_CLASSES: Record<NonNullable<TextBlockType['props']['alignment']>, string> = {
  left: 'text-left',
  center: 'mx-auto text-center',
  right: 'text-right ml-auto',
};

/**
 * Body-text block. Rendered inside a `prose`-class article so links,
 * paragraphs and inline emphasis pick up the design-system typography
 * defaults. The simplest block — but probably the most-used.
 */
export function TextBlock({
  block,
  locale,
  defaultLocale,
}: {
  block: TextBlockType;
  locale: Locale;
  defaultLocale: Locale;
}): React.JSX.Element {
  const content = getTranslatedString(block.props.content_translations, locale, defaultLocale);
  const alignment = ALIGNMENT_CLASSES[block.props.alignment ?? 'left'];

  return (
    <section data-testid={`text-block-${block.id}`} className="w-full px-6 py-12 sm:py-16">
      <article
        className={cn(
          'prose prose-neutral dark:prose-invert max-w-3xl text-base sm:text-lg',
          alignment
        )}
        data-testid="text-block-content"
      >
        {content.split('\n\n').map((paragraph, idx) => (
          <p key={idx}>{paragraph}</p>
        ))}
      </article>
    </section>
  );
}
