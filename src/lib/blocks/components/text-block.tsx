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
 * defaults.
 *
 * Step 41 introduced TipTap-edited content, which arrives here as
 * pre-sanitised HTML (e.g. `<p>foo <strong>bar</strong></p>`). We
 * detect HTML by a leading `<` and render with
 * `dangerouslySetInnerHTML`. The content has already passed through
 * `sanitizeHtml()` on write, so what we render here is allow-listed
 * HTML only. Legacy / seed strings without tags fall through to the
 * `\n\n` paragraph-split path.
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
  const isHtml = content.trimStart().startsWith('<');

  return (
    <section data-testid={`text-block-${block.id}`} className="w-full px-6 py-12 sm:py-16">
      <article
        className={cn(
          'prose prose-neutral dark:prose-invert max-w-3xl text-base sm:text-lg',
          alignment
        )}
        data-testid="text-block-content"
        {...(isHtml ? { dangerouslySetInnerHTML: { __html: content } } : {})}
      >
        {isHtml
          ? null
          : content.split('\n\n').map((paragraph, idx) => <p key={idx}>{paragraph}</p>)}
      </article>
    </section>
  );
}
