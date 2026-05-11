import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getPublicAvailabilityForRange } from '@/lib/bookings/public-availability';
import { getCurrentTenant } from '@/lib/tenant';
import { PublicBookingForm } from '@/components/bookings/public-booking-form';

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

  const t = await getTranslations('publicBooking');
  const tShared = await getTranslations('bookings');

  return (
    <main
      data-testid="public-booking-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <Link
          href={`/sites/${slug}`}
          data-testid="back-to-site"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {tenant.name}
        </Link>
        <h1 className="text-display-md mt-2 font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('subtitle')}</p>
      </header>

      <PublicBookingForm
        tenantSlug={slug}
        availability={availability}
        locale={locale}
        copy={{
          title: t('title'),
          subtitle: t('subtitle'),
          step1Title: t('step1Title'),
          step2Title: t('step2Title'),
          step3Title: t('step3Title'),
          step4Title: t('step4Title'),
          step5Title: t('step5Title'),
          back: t('back'),
          next: t('next'),
          submit: t('submit'),
          submitting: t('submitting'),
          datePicker: {
            fullyBooked: t('datePicker.fullyBooked'),
            closed: t('datePicker.closed'),
            slotsAvailable: t('datePicker.slotsAvailable'),
          },
          slotPicker: {
            noSlots: t('slotPicker.noSlots'),
            spotsLeft: t('slotPicker.spotsLeft'),
          },
          partySize: {
            label: t('partySize.label'),
            person: t('partySize.person'),
            people: t('partySize.people'),
          },
          contactForm: {
            name: t('contactForm.name'),
            namePlaceholder: t('contactForm.namePlaceholder'),
            email: t('contactForm.email'),
            emailPlaceholder: t('contactForm.emailPlaceholder'),
            emailHint: t('contactForm.emailHint'),
            phone: t('contactForm.phone'),
            phonePlaceholder: t('contactForm.phonePlaceholder'),
            notes: t('contactForm.notes'),
            notesPlaceholder: t('contactForm.notesPlaceholder'),
          },
          confirmation: {
            headline: t('confirmation.headline'),
            subheadline: t('confirmation.subheadline'),
            reference: t('confirmation.reference'),
            dateLabel: t('confirmation.dateLabel'),
            timeLabel: t('confirmation.timeLabel'),
            partyLabel: t('confirmation.partyLabel'),
            newBooking: t('confirmation.newBooking'),
            manageLink: t('confirmation.manageLink'),
          },
          errors: {
            validation_failed: t('errors.validation_failed'),
            tenant_not_available: t('errors.tenant_not_available'),
            slot_no_longer_available: t('errors.slot_no_longer_available'),
            spam_detected: t('errors.spam_detected'),
            unknown_error: t('errors.unknown_error'),
          },
          weekdayShort: [
            tShared('weekdayShort.sun'),
            tShared('weekdayShort.mon'),
            tShared('weekdayShort.tue'),
            tShared('weekdayShort.wed'),
            tShared('weekdayShort.thu'),
            tShared('weekdayShort.fri'),
            tShared('weekdayShort.sat'),
          ],
        }}
      />
    </main>
  );
}
