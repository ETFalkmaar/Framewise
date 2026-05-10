'use client';

import { useTranslations } from 'next-intl';

import { useConsent } from './consent-provider';

/**
 * Footer link that re-opens the cookie preferences modal so visitors
 * can change or withdraw their previous choice. GDPR requires that
 * withdrawing consent is as easy as giving it; this link is the
 * counterweight to the banner.
 */
export function CookieSettingsLink() {
  const t = useTranslations('consent');
  const { openModal } = useConsent();

  return (
    <button
      type="button"
      onClick={openModal}
      className="text-sm underline hover:no-underline"
      data-testid="cookie-settings-link"
    >
      {t('settings_link')}
    </button>
  );
}
