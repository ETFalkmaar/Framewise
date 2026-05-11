'use client';

import { useTransition } from 'react';

import type { GoLiveCelebrationData } from '@/lib/site/go-live';

import { markNotificationAsReadAction } from '@/app/(i18n)/[locale]/(auth-required)/admin/notifications/actions';

export interface GoLiveCelebrationCopy {
  headline: string;
  subheadline: string;
  /** Pattern with `{days}` placeholder; pluralisation handled server-side. */
  celebrationDays: string;
  celebrationDay: string;
  yourUrl: string;
  viewSite: string;
  shareLinkedIn: string;
  dismiss: string;
  noCustomDomain: string;
}

export interface GoLiveCelebrationProps {
  data: GoLiveCelebrationData;
  /** Id of the unread `publish_approved` notification driving the celebration. */
  notificationId: string;
  copy: GoLiveCelebrationCopy;
}

/**
 * Go-live celebration banner (step 48, fase 13 part 2/2). Renders
 * on `/account` when:
 *  - the tenant is live AND
 *  - the customer has an unread `publish_approved` notification
 *
 * Lightweight CSS confetti (six emoji dots with stagger) — no
 * heavy lib. The "Naar dashboard" button marks the notification
 * read so the banner stops appearing on next page load.
 */
export function GoLiveCelebration({
  data,
  notificationId,
  copy,
}: GoLiveCelebrationProps): React.ReactElement {
  const [pending, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      await markNotificationAsReadAction({ id: notificationId });
    });
  }

  const url =
    data.hasCustomDomain && data.customDomain ? `https://${data.customDomain}` : data.siteUrl;
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    typeof window !== 'undefined' && data.siteUrl.startsWith('/')
      ? `${window.location.origin}${data.siteUrl}`
      : url
  )}`;

  const daysCopy = (
    data.daysFromOnboarding === 1 ? copy.celebrationDay : copy.celebrationDays
  ).replace('{days}', String(data.daysFromOnboarding));

  return (
    <div
      data-testid="go-live-celebration"
      className="relative mb-6 overflow-hidden rounded-md border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-6 text-emerald-900 dark:text-emerald-100"
    >
      {/* Tiny CSS confetti — emoji dots scattered, no animation lib. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50">
        <span className="absolute top-2 left-4 text-2xl">🎉</span>
        <span className="absolute top-8 right-8 text-xl">✨</span>
        <span className="absolute bottom-4 left-12 text-lg">🎊</span>
        <span className="absolute right-16 bottom-6 text-2xl">🎉</span>
        <span className="absolute top-4 right-1/3 text-base">✨</span>
        <span className="absolute bottom-8 left-1/3 text-base">🎊</span>
      </div>

      <div className="relative">
        <h2 data-testid="go-live-headline" className="text-4xl font-bold tracking-tight">
          {copy.headline}
        </h2>
        <p className="mt-2 text-sm opacity-90">{copy.subheadline}</p>

        <div className="bg-background/60 mt-5 rounded-md p-4">
          <p className="text-muted-foreground font-mono text-xs">{copy.yourUrl}</p>
          <p className="mt-1 font-mono text-sm break-all">{url}</p>
          <p className="mt-2 text-xs">{daysCopy}</p>
        </div>

        {!data.hasCustomDomain && (
          <p className="text-muted-foreground mt-3 text-xs">{copy.noCustomDomain}</p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="go-live-view-site"
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            {copy.viewSite}
          </a>
          <a
            href={linkedInShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="go-live-share-linkedin"
            className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 text-sm ring-1 transition"
          >
            {copy.shareLinkedIn}
          </a>
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            data-testid="go-live-dismiss"
            className="text-muted-foreground hover:text-foreground rounded-md px-4 py-2 text-sm transition disabled:opacity-50"
          >
            {copy.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
