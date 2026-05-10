import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

/**
 * Placeholder privacy policy. Step 93 ships the real DPA + privacy
 * template generator; for now this page exists so the consent
 * banner's "Read our privacy policy" link resolves to a 200 page
 * instead of a 404.
 */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('privacy');

  return (
    <main data-testid="privacy-page" className="container mx-auto max-w-3xl px-4 py-12">
      <article className="prose prose-invert prose-headings:font-semibold space-y-4">
        <h1 className="text-display-md font-bold">{t('title')}</h1>
        <p>{t('placeholder_content')}</p>
        <p className="text-muted-foreground text-sm italic">{t('placeholder_note')}</p>
      </article>
    </main>
  );
}
