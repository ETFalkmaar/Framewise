import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { canCustomerCancel, canCustomerReschedule } from '@/lib/bookings/can-modify';
import { getPublicAvailabilityForRange } from '@/lib/bookings/public-availability';
import { bookingsRepo, tenantsRepo } from '@/lib/data';
import { CustomerSelfService } from '@/components/bookings/customer-self-service';
import type { SelfServiceError } from './actions';
import { verifyBookingEmail } from './actions';

/**
 * Public booking lookup page (step 54, fase 14 part 6/7) at
 * `/sites/<slug>/booking/<reference>`. Three render modes:
 *
 *  1. `?email=...` matches the booking → server-side verify sets
 *     the cookie, then we render the detail view.
 *  2. Cookie already present → render detail view.
 *  3. No cookie / no email param → render the email confirm form.
 *
 * The email match check lives in `verifyBookingEmail` (the same
 * server action the form uses) so the two paths can't drift.
 */
export default async function CustomerBookingLookupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; slug: string; reference: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale, slug, reference } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const tenant = await tenantsRepo.findBySlug(slug);
  if (!tenant) notFound();
  if (!tenant.bookings_enabled) notFound();

  const booking = await bookingsRepo.findByReferenceCode(reference);
  if (!booking || booking.tenant_id !== tenant.id) notFound();

  // Cookie-or-query-param verify resolution.
  const cookieStore = await cookies();
  const cookieName = `booking_verified_${reference}`;
  let verified = cookieStore.get(cookieName)?.value === 'true';

  if (!verified && search.email) {
    const r = await verifyBookingEmail({
      tenantSlug: slug,
      reference,
      email: search.email,
    });
    if (r.success) verified = true;
  }

  // Pre-load the 14-day availability snapshot so the reschedule
  // modal renders instantly when opened.
  const today = new Date();
  const toIso = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate()
    ).padStart(2, '0')}`;
  const horizon = new Date(today);
  horizon.setUTCDate(today.getUTCDate() + 13);
  const rescheduleAvailability = verified
    ? await getPublicAvailabilityForRange({
        tenantId: tenant.id,
        from: toIso(today),
        to: toIso(horizon),
        partySize: booking.party_size,
      })
    : [];

  const cancelGate = canCustomerCancel(booking);
  const rescheduleGate = canCustomerReschedule(booking);

  const t = await getTranslations('publicBooking.selfService');
  const tShared = await getTranslations('bookings');

  return (
    <main
      data-testid="customer-self-service-page"
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
      </header>

      <CustomerSelfService
        tenantSlug={slug}
        booking={booking}
        verified={verified}
        cancelAllowed={cancelGate.allowed}
        cancelDenialReason={cancelGate.reason as SelfServiceError | undefined}
        rescheduleAllowed={rescheduleGate.allowed}
        rescheduleDenialReason={rescheduleGate.reason as SelfServiceError | undefined}
        rescheduleAvailability={rescheduleAvailability}
        locale={locale}
        manageHrefFactory={(newRef) => `/sites/${slug}/booking/${newRef}`}
        copy={{
          title: t('title'),
          viewReservation: t('viewReservation'),
          manageReservation: t('manageReservation'),
          emailVerifyTitle: t('emailVerifyTitle'),
          emailVerifySubtitle: t('emailVerifySubtitle'),
          emailVerifyPlaceholder: t('emailVerifyPlaceholder'),
          emailVerifyButton: t('emailVerifyButton'),
          emailMismatch: t('emailMismatch'),
          details: {
            reference: t('details.reference'),
            date: t('details.date'),
            time: t('details.time'),
            party: t('details.party'),
            customer: t('details.customer'),
            notes: t('details.notes'),
          },
          status: {
            pending: t('status.pending'),
            confirmed: t('status.confirmed'),
            cancelled: t('status.cancelled'),
            completed: t('status.completed'),
            no_show: t('status.noShow'),
            past: t('status.past'),
          },
          cancel: {
            button: t('cancel.button'),
            confirmTitle: t('cancel.confirmTitle'),
            confirmBody: t('cancel.confirmBody'),
            reasonLabel: t('cancel.reasonLabel'),
            reasonPlaceholder: t('cancel.reasonPlaceholder'),
            submit: t('cancel.submit'),
            cancel: t('cancel.cancelButton'),
            successHeadline: t('cancel.successHeadline'),
            successBody: t('cancel.successBody'),
            tooClose: t('cancel.tooClose'),
            alreadyCancelled: t('cancel.alreadyCancelled'),
            past: t('cancel.past'),
          },
          reschedule: {
            button: t('reschedule.button'),
            title: t('reschedule.title'),
            selectNewDate: t('reschedule.selectNewDate'),
            selectNewTime: t('reschedule.selectNewTime'),
            preview: t('reschedule.preview'),
            confirm: t('reschedule.confirm'),
            cancel: t('reschedule.cancelButton'),
            tooClose: t('reschedule.tooClose'),
            successHeadline: t('reschedule.successHeadline'),
            successBody: t('reschedule.successBody'),
          },
          cancelledView: {
            title: t('cancelled.title'),
            subtitle: t('cancelled.subtitle'),
            newBooking: t('cancelled.newBooking'),
          },
          pastView: {
            title: t('past.title'),
            subtitle: t('past.subtitle'),
            newBooking: t('past.newBooking'),
          },
          errors: {
            forbidden: t('errors.forbidden'),
            email_mismatch: t('emailMismatch'),
            not_found: t('errors.notFound'),
            cannot_cancel: t('cancel.tooClose'),
            cannot_reschedule: t('reschedule.tooClose'),
            too_close: t('cancel.tooClose'),
            past_booking: t('cancel.past'),
            already_cancelled: t('cancel.alreadyCancelled'),
            wrong_status: t('errors.wrongStatus'),
            slot_not_available: t('errors.slotNotAvailable'),
            validation_failed: t('errors.validationFailed'),
            unknown_error: t('errors.unknown'),
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
          noSlots: t('reschedule.noSlots'),
          spotsLeft: t('reschedule.spotsLeft'),
          closedLabel: t('reschedule.closed'),
        }}
      />
    </main>
  );
}
