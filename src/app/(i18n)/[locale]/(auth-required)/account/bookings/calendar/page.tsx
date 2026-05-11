import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CalendarFeedSettings } from '@/components/bookings/calendar-feed-settings';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { resolveBaseUrl } from '@/lib/seo/base-url';
import { canManageBookings } from '@/lib/permissions/bookings';

/**
 * Calendar-feed management page (step 55, fase 14 finale) at
 * `/account/bookings/calendar`. Owner-only; non-managers hit 404.
 *
 * Page handles three states:
 *  1. No token yet → generate-flow.
 *  2. Token present → show feed URL + copy button + rotate / revoke.
 *
 * The actual token mutation lives in `actions.ts`; this server
 * component just resolves the current tenant + token and renders
 * the client wrapper.
 */
export default async function CalendarFeedPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const tenant = await getActiveTenantForUser();
  if (!tenant) notFound();
  const allowed = await canManageBookings(user.id, tenant);
  if (!allowed) notFound();

  const baseUrl = resolveBaseUrl();
  const feedUrlBase = `${baseUrl}/api/tenants/${tenant.id}/calendar.ics`;

  const t = await getTranslations('bookings.calendarFeed');

  return (
    <main
      data-testid="calendar-feed-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <Link
          href="/account/bookings"
          data-testid="back-to-bookings"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {t('backToBookings')}
        </Link>
        <h1 className="text-display-md mt-2 font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('subtitle')}</p>
      </header>

      <CalendarFeedSettings
        initialToken={tenant.calendar_feed_token}
        feedUrlBase={feedUrlBase}
        copy={{
          noToken: t('noToken'),
          generateButton: t('generateButton'),
          feedUrlLabel: t('feedUrlLabel'),
          copyButton: t('copyButton'),
          copied: t('copied'),
          instructionsTitle: t('instructions.title'),
          instructionsGoogle: t('instructions.google'),
          instructionsApple: t('instructions.apple'),
          instructionsOutlook: t('instructions.outlook'),
          rotate: t('rotate'),
          rotateConfirm: t('rotateConfirm'),
          revoke: t('revoke'),
          revokeConfirm: t('revokeConfirm'),
          errorGeneric: t('errorGeneric'),
        }}
      />
    </main>
  );
}
