import type { Booking, Tenant } from '@/types/database';

/**
 * Booking email templates (step 52, fase 14 part 4/7). Plain-text
 * for now — Step 21 upgrades the email-stub to a real provider and
 * we'll author MJML/HTML versions then. Subjects + bodies are
 * locale-aware (NL/FR/EN) with a hard-coded copy block per language
 * so we don't need to drag next-intl into a non-component module.
 *
 * Every helper returns a `{ subject, body }` object that the caller
 * pipes straight into `queueEmail({ to, subject, body, tenantId })`.
 */
export type EmailLocale = 'nl' | 'fr' | 'en';

export interface EmailTemplate {
  subject: string;
  body: string;
}

/**
 * Format the booking's start_time into a long-form date + 24h time
 * label for the given locale. Uses UTC to match the mock adapter's
 * timezone-free semantics (tenant booking_timezone wiring lands at
 * step 119 with the Supabase swap).
 */
function formatStart(booking: Booking, locale: EmailLocale): { date: string; time: string } {
  const dt = new Date(booking.start_time);
  const date = dt.toLocaleDateString(localeTag(locale), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const time = dt.toLocaleTimeString(localeTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  return { date, time };
}

function localeTag(locale: EmailLocale): string {
  return locale === 'nl' ? 'nl-NL' : locale === 'fr' ? 'fr-FR' : 'en-US';
}

/**
 * Customer-facing email sent after a booking is created (status =
 * pending, awaiting owner confirmation). The reference code is the
 * primary handle for any follow-up — the customer can quote it when
 * they want to amend or cancel.
 */
export function bookingCustomerConfirmationEmail(
  booking: Booking,
  tenant: Tenant,
  locale: EmailLocale = 'nl'
): EmailTemplate {
  const { date, time } = formatStart(booking, locale);
  const partyLabel =
    booking.party_size === 1
      ? translate(locale, 'onePerson')
      : translate(locale, 'multiplePeople').replace('{count}', String(booking.party_size));

  const subject = translate(locale, 'customerCreatedSubject').replace('{tenant}', tenant.name);
  const body = [
    translate(locale, 'customerHello').replace('{name}', booking.customer_name),
    '',
    translate(locale, 'customerCreatedIntro').replace('{tenant}', tenant.name),
    '',
    `${translate(locale, 'labelDate')}: ${date}`,
    `${translate(locale, 'labelTime')}: ${time}`,
    `${translate(locale, 'labelGuests')}: ${partyLabel}`,
    `${translate(locale, 'labelReference')}: ${booking.reference_code}`,
    booking.notes ? '' : null,
    booking.notes ? `${translate(locale, 'labelYourNotes')}: ${booking.notes}` : null,
    '',
    translate(locale, 'customerCreatedOutro'),
    '',
    tenant.name,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject, body };
}

/**
 * Tenant-owner notification for the same event. Operators want a
 * compact summary at the top so the inbox preview is useful, then
 * the customer's optional message at the bottom so they can plan
 * the seating.
 */
export function bookingOwnerNotificationEmail(
  booking: Booking,
  tenant: Tenant,
  locale: EmailLocale = 'nl'
): EmailTemplate {
  const { date, time } = formatStart(booking, locale);
  const subject = translate(locale, 'ownerCreatedSubject').replace(
    '{reference}',
    booking.reference_code
  );
  const body = [
    translate(locale, 'ownerHello').replace('{tenant}', tenant.name),
    '',
    translate(locale, 'ownerCreatedIntro'),
    '',
    `${translate(locale, 'labelReference')}: ${booking.reference_code}`,
    `${translate(locale, 'labelCustomer')}: ${booking.customer_name} <${booking.customer_email}>`,
    booking.customer_phone ? `${translate(locale, 'labelPhone')}: ${booking.customer_phone}` : null,
    `${translate(locale, 'labelDate')}: ${date} ${time}`,
    `${translate(locale, 'labelGuests')}: ${booking.party_size}`,
    booking.notes ? `${translate(locale, 'labelCustomerNotes')}: ${booking.notes}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
  return { subject, body };
}

/**
 * Customer-facing email sent when the owner moves the booking from
 * `pending` → `confirmed`. Keeps the reference code visible so the
 * customer can still amend if needed.
 */
export function bookingConfirmedEmail(
  booking: Booking,
  tenant: Tenant,
  locale: EmailLocale = 'nl'
): EmailTemplate {
  const { date, time } = formatStart(booking, locale);
  const subject = translate(locale, 'customerConfirmedSubject').replace('{tenant}', tenant.name);
  const body = [
    translate(locale, 'customerHello').replace('{name}', booking.customer_name),
    '',
    translate(locale, 'customerConfirmedIntro').replace('{tenant}', tenant.name),
    '',
    `${translate(locale, 'labelDate')}: ${date}`,
    `${translate(locale, 'labelTime')}: ${time}`,
    `${translate(locale, 'labelReference')}: ${booking.reference_code}`,
    '',
    translate(locale, 'customerConfirmedOutro'),
    '',
    tenant.name,
  ].join('\n');
  return { subject, body };
}

/**
 * Customer-facing email sent when the booking is cancelled. If the
 * operator left a reason via the cancel flow we surface it so the
 * customer doesn't get a no-context "your booking was cancelled".
 */
export function bookingCancellationEmail(
  booking: Booking,
  tenant: Tenant,
  locale: EmailLocale = 'nl'
): EmailTemplate {
  const { date, time } = formatStart(booking, locale);
  const subject = translate(locale, 'customerCancelledSubject').replace('{tenant}', tenant.name);
  const reasonLine = booking.cancellation_reason
    ? `${translate(locale, 'labelReason')}: ${booking.cancellation_reason}`
    : null;
  const body = [
    translate(locale, 'customerHello').replace('{name}', booking.customer_name),
    '',
    translate(locale, 'customerCancelledIntro').replace('{tenant}', tenant.name),
    '',
    `${translate(locale, 'labelDate')}: ${date}`,
    `${translate(locale, 'labelTime')}: ${time}`,
    `${translate(locale, 'labelReference')}: ${booking.reference_code}`,
    reasonLine,
    '',
    translate(locale, 'customerCancelledOutro'),
    '',
    tenant.name,
  ]
    .filter((line) => line !== null)
    .join('\n');
  return { subject, body };
}

/**
 * Customer notification when they reschedule via the self-service
 * page (step 54). Shows the old slot crossed-out → new slot, plus
 * the new reference code so they can pull it up again later.
 */
export function bookingRescheduledEmail(
  oldBooking: Booking,
  newBooking: Booking,
  tenant: Tenant,
  locale: EmailLocale = 'nl'
): EmailTemplate {
  const oldFmt = formatStart(oldBooking, locale);
  const newFmt = formatStart(newBooking, locale);
  const subject = translate(locale, 'customerRescheduledSubject').replace(
    '{tenant}',
    tenant.name
  );
  const body = [
    translate(locale, 'customerHello').replace('{name}', newBooking.customer_name),
    '',
    translate(locale, 'customerRescheduledIntro').replace('{tenant}', tenant.name),
    '',
    `${translate(locale, 'labelOldSlot')}: ${oldFmt.date} ${oldFmt.time}`,
    `${translate(locale, 'labelNewSlot')}: ${newFmt.date} ${newFmt.time}`,
    `${translate(locale, 'labelReference')}: ${newBooking.reference_code}`,
    '',
    translate(locale, 'customerRescheduledOutro'),
    '',
    tenant.name,
  ].join('\n');
  return { subject, body };
}

/**
 * Reminder email used by the step-95 cron — the helper lives here
 * so the copy is colocated with the rest of the booking emails.
 */
export function bookingReminderEmail(
  booking: Booking,
  tenant: Tenant,
  locale: EmailLocale = 'nl'
): EmailTemplate {
  const { date, time } = formatStart(booking, locale);
  const subject = translate(locale, 'customerReminderSubject').replace('{tenant}', tenant.name);
  const body = [
    translate(locale, 'customerHello').replace('{name}', booking.customer_name),
    '',
    translate(locale, 'customerReminderIntro').replace('{tenant}', tenant.name),
    '',
    `${translate(locale, 'labelDate')}: ${date}`,
    `${translate(locale, 'labelTime')}: ${time}`,
    `${translate(locale, 'labelGuests')}: ${booking.party_size}`,
    `${translate(locale, 'labelReference')}: ${booking.reference_code}`,
    '',
    translate(locale, 'customerReminderOutro'),
    '',
    tenant.name,
  ].join('\n');
  return { subject, body };
}

// ────────────────────────────────────────────────────────────────────────────
// Tiny per-locale copy table — colocated so the template helpers stay pure
// and don't need to import next-intl (which is a component-context API).
// ────────────────────────────────────────────────────────────────────────────

type Key =
  | 'customerCreatedSubject'
  | 'customerHello'
  | 'customerCreatedIntro'
  | 'customerCreatedOutro'
  | 'customerConfirmedSubject'
  | 'customerConfirmedIntro'
  | 'customerConfirmedOutro'
  | 'customerCancelledSubject'
  | 'customerCancelledIntro'
  | 'customerCancelledOutro'
  | 'customerReminderSubject'
  | 'customerReminderIntro'
  | 'customerReminderOutro'
  | 'customerRescheduledSubject'
  | 'customerRescheduledIntro'
  | 'customerRescheduledOutro'
  | 'ownerCreatedSubject'
  | 'ownerHello'
  | 'ownerCreatedIntro'
  | 'labelDate'
  | 'labelTime'
  | 'labelGuests'
  | 'labelReference'
  | 'labelReason'
  | 'labelPhone'
  | 'labelCustomer'
  | 'labelCustomerNotes'
  | 'labelYourNotes'
  | 'labelOldSlot'
  | 'labelNewSlot'
  | 'onePerson'
  | 'multiplePeople';

const COPY: Record<EmailLocale, Record<Key, string>> = {
  nl: {
    customerCreatedSubject: 'Reservering ontvangen - {tenant}',
    customerHello: 'Beste {name},',
    customerCreatedIntro:
      'Bedankt voor je reservering bij {tenant}. We hebben je aanvraag ontvangen.',
    customerCreatedOutro:
      'Je krijgt een aparte bevestigingsmail zodra we de reservering definitief maken.',
    customerConfirmedSubject: 'Reservering bevestigd - {tenant}',
    customerConfirmedIntro: 'Goed nieuws — je reservering bij {tenant} is bevestigd.',
    customerConfirmedOutro: 'We zien je graag!',
    customerCancelledSubject: 'Reservering geannuleerd - {tenant}',
    customerCancelledIntro: 'Je reservering bij {tenant} is geannuleerd.',
    customerCancelledOutro: 'Hopelijk tot een andere keer.',
    customerReminderSubject: 'Herinnering: reservering bij {tenant}',
    customerReminderIntro: 'Een korte herinnering aan je reservering bij {tenant}.',
    customerReminderOutro: 'Tot snel!',
    customerRescheduledSubject: 'Reservering verzet - {tenant}',
    customerRescheduledIntro: 'Je reservering bij {tenant} is verzet.',
    customerRescheduledOutro: 'Tot snel!',
    ownerCreatedSubject: 'Nieuwe reservering: {reference}',
    ownerHello: 'Hi {tenant} team,',
    ownerCreatedIntro: 'Een nieuwe online reservering is binnengekomen.',
    labelDate: 'Datum',
    labelTime: 'Tijd',
    labelGuests: 'Personen',
    labelReference: 'Reserveringscode',
    labelReason: 'Reden',
    labelPhone: 'Telefoon',
    labelCustomer: 'Klant',
    labelCustomerNotes: 'Notities van de klant',
    labelYourNotes: 'Je opmerkingen',
    labelOldSlot: 'Oude tijd',
    labelNewSlot: 'Nieuwe tijd',
    onePerson: '1 persoon',
    multiplePeople: '{count} personen',
  },
  fr: {
    customerCreatedSubject: 'Réservation reçue - {tenant}',
    customerHello: 'Bonjour {name},',
    customerCreatedIntro:
      'Merci pour votre réservation chez {tenant}. Nous avons bien reçu votre demande.',
    customerCreatedOutro:
      'Vous recevrez un e-mail de confirmation séparé dès que la réservation sera validée.',
    customerConfirmedSubject: 'Réservation confirmée - {tenant}',
    customerConfirmedIntro: 'Bonne nouvelle — votre réservation chez {tenant} est confirmée.',
    customerConfirmedOutro: 'À très bientôt !',
    customerCancelledSubject: 'Réservation annulée - {tenant}',
    customerCancelledIntro: 'Votre réservation chez {tenant} a été annulée.',
    customerCancelledOutro: 'À une prochaine fois.',
    customerReminderSubject: 'Rappel : réservation chez {tenant}',
    customerReminderIntro: 'Un petit rappel concernant votre réservation chez {tenant}.',
    customerReminderOutro: 'À bientôt !',
    customerRescheduledSubject: 'Réservation reprogrammée - {tenant}',
    customerRescheduledIntro: 'Votre réservation chez {tenant} a été reprogrammée.',
    customerRescheduledOutro: 'À bientôt !',
    ownerCreatedSubject: 'Nouvelle réservation : {reference}',
    ownerHello: 'Bonjour équipe {tenant},',
    ownerCreatedIntro: 'Une nouvelle réservation en ligne est arrivée.',
    labelDate: 'Date',
    labelTime: 'Heure',
    labelGuests: 'Personnes',
    labelReference: 'Code de réservation',
    labelReason: 'Motif',
    labelPhone: 'Téléphone',
    labelCustomer: 'Client',
    labelCustomerNotes: 'Notes du client',
    labelYourNotes: 'Vos remarques',
    labelOldSlot: 'Ancienne heure',
    labelNewSlot: 'Nouvelle heure',
    onePerson: '1 personne',
    multiplePeople: '{count} personnes',
  },
  en: {
    customerCreatedSubject: 'Reservation received - {tenant}',
    customerHello: 'Hi {name},',
    customerCreatedIntro: 'Thanks for your reservation at {tenant}. We received your request.',
    customerCreatedOutro:
      "You'll get a separate confirmation email once we finalize the reservation.",
    customerConfirmedSubject: 'Reservation confirmed - {tenant}',
    customerConfirmedIntro: 'Good news — your reservation at {tenant} is confirmed.',
    customerConfirmedOutro: 'See you soon!',
    customerCancelledSubject: 'Reservation cancelled - {tenant}',
    customerCancelledIntro: 'Your reservation at {tenant} has been cancelled.',
    customerCancelledOutro: 'Hope to see you another time.',
    customerReminderSubject: 'Reminder: reservation at {tenant}',
    customerReminderIntro: 'A quick reminder about your reservation at {tenant}.',
    customerReminderOutro: 'See you soon!',
    customerRescheduledSubject: 'Reservation rescheduled - {tenant}',
    customerRescheduledIntro: 'Your reservation at {tenant} has been rescheduled.',
    customerRescheduledOutro: 'See you soon!',
    ownerCreatedSubject: 'New reservation: {reference}',
    ownerHello: 'Hi {tenant} team,',
    ownerCreatedIntro: 'A new online reservation just came in.',
    labelDate: 'Date',
    labelTime: 'Time',
    labelGuests: 'Guests',
    labelReference: 'Reservation code',
    labelReason: 'Reason',
    labelPhone: 'Phone',
    labelCustomer: 'Customer',
    labelCustomerNotes: 'Customer notes',
    labelYourNotes: 'Your notes',
    labelOldSlot: 'Old time',
    labelNewSlot: 'New time',
    onePerson: '1 person',
    multiplePeople: '{count} people',
  },
};

function translate(locale: EmailLocale, key: Key): string {
  return COPY[locale][key];
}
