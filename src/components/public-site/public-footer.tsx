import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { CookieSettingsLink } from '@/components/consent/cookie-settings-link';

/**
 * Footer rendered on every public tenant page (step 28). Carries
 * the privacy / terms links plus the GDPR-mandated "Cookie
 * settings" button that re-opens the consent modal — GDPR rule:
 * withdrawing consent must be as easy as giving it.
 */
export function PublicFooter() {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer data-testid="public-footer" className="border-border bg-background mt-12 border-t">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="text-muted-foreground flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
          <p>
            © {year} {t('brand')}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="underline hover:no-underline">
              {t('privacy')}
            </Link>
            <Link href="/terms" className="underline hover:no-underline">
              {t('terms')}
            </Link>
            <CookieSettingsLink />
          </div>
        </div>
      </div>
    </footer>
  );
}
