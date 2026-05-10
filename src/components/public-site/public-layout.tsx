import { ConsentProvider } from '@/components/consent/consent-provider';
import { ConsentModal } from '@/components/consent/consent-modal';
import { CookieBanner } from '@/components/consent/cookie-banner';

import { PublicFooter } from './public-footer';

/**
 * Wraps every public tenant page with the GDPR consent
 * scaffolding (step 28): provider context, the bottom banner for
 * first-time visitors, and the granular preferences modal that
 * the banner's "Customise" button and the footer's "Cookie
 * settings" link both open.
 *
 * Server component — `ConsentProvider` is the only client island,
 * and the banner/modal are rendered as siblings so they fixed-
 * position over the page content without interfering with the
 * renderer's layout.
 */
export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsentProvider>
      <div className="flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
        <PublicFooter />
      </div>
      <CookieBanner />
      <ConsentModal />
    </ConsentProvider>
  );
}
