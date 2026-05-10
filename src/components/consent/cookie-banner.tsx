'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { ACCEPT_ALL, DEFAULT_DENY, useConsent } from './consent-provider';

/**
 * Bottom-fixed cookie consent banner. Shown to first-time visitors
 * (no valid consent record in `localStorage`) and dismissed once
 * the user picks one of the three actions. The "Customise" button
 * opens the `<ConsentModal />` for granular per-category control.
 *
 * Buttons:
 *  - Customise — open the preferences modal
 *  - Only necessary — persist `DEFAULT_DENY` (necessary only)
 *  - Accept all — persist `ACCEPT_ALL` (everything opt-in)
 */
export function CookieBanner() {
  const t = useTranslations('consent.banner');
  const { showBanner, setChoices, openModal } = useConsent();

  if (!showBanner) return null;

  return (
    <div
      data-testid="cookie-banner"
      role="dialog"
      aria-label={t('aria_label')}
      className="bg-background border-border fixed inset-x-0 bottom-0 z-50 border-t shadow-lg"
    >
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <h2 className="mb-2 font-semibold">{t('title')}</h2>
            <p className="text-muted-foreground text-sm">
              {t('description')}{' '}
              <Link href="/privacy" className="underline" data-testid="banner-privacy-link">
                {t('privacy_link')}
              </Link>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={openModal} data-testid="banner-customize">
              {t('customize')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setChoices(DEFAULT_DENY)}
              data-testid="banner-deny"
            >
              {t('only_necessary')}
            </Button>
            <Button onClick={() => setChoices(ACCEPT_ALL)} data-testid="banner-accept">
              {t('accept_all')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
