import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { getPublicAvailabilityForRange } from '@/lib/bookings/public-availability';
import { getCurrentTenant } from '@/lib/tenant';

/**
 * Public booking page (step 51, fase 14 part 3/7) at
 * `/sites/<slug>/boek`. Anonymous visitors arrive here from the
 * tenant's own homepage and walk a five-step form: date → time →
 * party size → contact info → confirmation. The page is server-
 * rendered so the initial availability snapshot is in the HTML —
 * no flash-of-loading on the calendar.
 *
 * Only tenants with `bookings_enabled` reach the form; everyone else
 * hits a 404 (matches the homepage check — we don't reveal the
 * existence of the route to disabled tenants).
 */
export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const tenant = await getCurrentTenant();
  if (!tenant) notFound();
  if (!tenant.bookings_enabled) notFound();

  // Pre-load the 14-day availability snapshot so the date picker
  // renders with greying-out for closed days. Two weeks balances
  // payload size against giving the visitor enough room to plan.
  const today = new Date();
  const toIso = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate()
    ).padStart(2, '0')}`;
  const horizon = new Date(today);
  horizon.setUTCDate(today.getUTCDate() + 13);

  const availability = await getPublicAvailabilityForRange({
    tenantId: tenant.id,
    from: toIso(today),
    to: toIso(horizon),
  });

  // CP1 placeholder render — replaced by the multi-step form
  // component in CP3 when the i18n keys land.
  return (
    <main
      data-testid="public-booking-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <h1 className="text-display-md font-bold tracking-tight">Reserveer een tafel</h1>
        <p className="text-muted-foreground mt-2 text-sm">{tenant.name}</p>
      </header>
      <pre
        data-testid="public-booking-cp1-payload"
        className="bg-muted/40 overflow-x-auto rounded-md p-4 font-mono text-xs"
      >
        {JSON.stringify({ slug, availability }, null, 2)}
      </pre>
    </main>
  );
}
