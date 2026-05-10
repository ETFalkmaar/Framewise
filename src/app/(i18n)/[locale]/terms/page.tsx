import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

/**
 * Placeholder terms-of-service page. Step 93 ships the real
 * template; this exists so the public footer's "Terms" link works.
 */
export default async function TermsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('terms');

  return (
    <main data-testid="terms-page" className="container mx-auto max-w-3xl px-4 py-12">
      <article className="prose prose-invert prose-headings:font-semibold space-y-4">
        <h1 className="text-display-md font-bold">{t('title')}</h1>
        <p>{t('placeholder_content')}</p>
        <p className="text-muted-foreground text-sm italic">{t('placeholder_note')}</p>
      </article>
    </main>
  );
}
