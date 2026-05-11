'use client';

import { useState, useTransition } from 'react';

import {
  customerCancelBooking,
  customerRescheduleBooking,
  verifyBookingEmail,
  type SelfServiceError,
} from '@/app/(i18n)/[locale]/sites/[slug]/booking/[reference]/actions';
import { fetchPublicSlots } from '@/app/(i18n)/[locale]/sites/[slug]/boek/actions';
import type { PublicAvailabilityDay } from '@/lib/bookings/public-availability';
import type { BookingSlot } from '@/lib/bookings/slot-generator';
import type { Booking, BookingStatus } from '@/types/database';

export interface SelfServiceCopy {
  title: string;
  viewReservation: string;
  manageReservation: string;
  emailVerifyTitle: string;
  emailVerifySubtitle: string;
  emailVerifyPlaceholder: string;
  emailVerifyButton: string;
  emailMismatch: string;
  details: {
    reference: string;
    date: string;
    time: string;
    party: string;
    customer: string;
    notes: string;
  };
  status: Record<BookingStatus | 'past', string>;
  cancel: {
    button: string;
    confirmTitle: string;
    confirmBody: string;
    reasonLabel: string;
    reasonPlaceholder: string;
    submit: string;
    cancel: string;
    successHeadline: string;
    successBody: string;
    tooClose: string;
    alreadyCancelled: string;
    past: string;
  };
  reschedule: {
    button: string;
    title: string;
    selectNewDate: string;
    selectNewTime: string;
    preview: string;
    confirm: string;
    cancel: string;
    tooClose: string;
    successHeadline: string;
    successBody: string;
  };
  cancelledView: {
    title: string;
    subtitle: string;
    newBooking: string;
  };
  pastView: {
    title: string;
    subtitle: string;
    newBooking: string;
  };
  errors: Partial<Record<SelfServiceError, string>>;
  weekdayShort: string[];
  /** Empty-state message for the slot picker when no slots match. */
  noSlots: string;
  spotsLeft: string;
  closedLabel: string;
}

export interface CustomerSelfServiceProps {
  tenantSlug: string;
  /** Stub booking — only the fields the UI needs are read; we keep
   *  the full type so the parent can pass the server-fetched row. */
  booking: Booking;
  /** `null` when the customer hasn't confirmed their email yet. */
  verified: boolean;
  cancelAllowed: boolean;
  cancelDenialReason?: SelfServiceError;
  rescheduleAllowed: boolean;
  rescheduleDenialReason?: SelfServiceError;
  /** 14-day availability snapshot for the reschedule picker. */
  rescheduleAvailability: PublicAvailabilityDay[];
  locale: string;
  /** New booking URL after a successful reschedule (server provides). */
  manageHrefFactory: (reference: string) => string;
  copy: SelfServiceCopy;
}

/**
 * Customer self-service flow (step 54). Three render modes driven
 * by `verified`, `booking.status`, and the modification gates:
 *
 *  1. **Verify** — visitor arrived without (or with stale) cookie.
 *     They confirm their email, server matches it case-insensitively
 *     and sets a 1h cookie, page reloads in detail mode.
 *  2. **Detail** — booking is still active. Customer sees the
 *     reference + slot + status, plus Cancel / Reschedule buttons
 *     that respect the can-modify gates.
 *  3. **Terminal** — booking is cancelled, completed, or in the
 *     past. Customer sees the reason + a CTA to book again.
 */
export function CustomerSelfService(props: CustomerSelfServiceProps): React.ReactElement {
  const { verified } = props;
  if (!verified) return <EmailVerifyForm {...props} />;
  return <BookingDetailView {...props} />;
}

function EmailVerifyForm(props: CustomerSelfServiceProps): React.ReactElement {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<SelfServiceError | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const r = await verifyBookingEmail({
        tenantSlug: props.tenantSlug,
        reference: props.booking.reference_code,
        email: email.trim(),
      });
      if (r.success) {
        // Cookie is set; reload so the server component sees it.
        window.location.reload();
      } else {
        setError(r.error ?? 'unknown_error');
      }
    });
  }

  return (
    <section
      data-testid="email-verify-form"
      className="border-border bg-muted/20 mx-auto max-w-md rounded-lg border p-6"
    >
      <h2 className="text-xl font-semibold">{props.copy.emailVerifyTitle}</h2>
      <p className="text-muted-foreground mt-2 text-sm">{props.copy.emailVerifySubtitle}</p>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={props.copy.emailVerifyPlaceholder}
          data-testid="verify-email-input"
          required
          className="bg-background border-input rounded-md border px-3 py-2 text-sm"
        />
        {error ? (
          <p
            data-testid="verify-error"
            className="text-destructive ring-destructive/40 bg-destructive/10 rounded-md px-3 py-2 text-sm ring-1"
          >
            {props.copy.errors[error] ?? props.copy.emailMismatch}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || !email.trim()}
          data-testid="verify-submit"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
        >
          {props.copy.emailVerifyButton}
        </button>
      </form>
    </section>
  );
}

function BookingDetailView(props: CustomerSelfServiceProps): React.ReactElement {
  const status = props.booking.status;
  // Capture "now" lazily at first render so the purity lint passes —
  // we don't need this to tick during the session.
  const [isPast] = useState(
    () => new Date(props.booking.start_time).getTime() < Date.now()
  );

  if (status === 'cancelled') {
    return <CancelledView {...props} />;
  }
  if (isPast || status === 'completed' || status === 'no_show') {
    return <PastView {...props} />;
  }
  return <ActiveBookingView {...props} />;
}

function ActiveBookingView(props: CustomerSelfServiceProps): React.ReactElement {
  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  return (
    <div data-testid="booking-detail" className="space-y-6">
      <BookingSummary {...props} />

      {resultMessage ? (
        <p
          data-testid="result-message"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {resultMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {props.rescheduleAllowed ? (
          <button
            type="button"
            onClick={() => setShowReschedule(true)}
            data-testid="reschedule-button"
            className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 text-sm ring-1"
          >
            {props.copy.reschedule.button}
          </button>
        ) : props.rescheduleDenialReason === 'too_close' ? (
          <span data-testid="reschedule-denied" className="text-muted-foreground text-xs italic">
            {props.copy.reschedule.tooClose}
          </span>
        ) : null}

        {props.cancelAllowed ? (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            data-testid="cancel-button"
            className="ring-destructive/40 text-destructive hover:bg-destructive/10 rounded-md px-4 py-2 text-sm ring-1"
          >
            {props.copy.cancel.button}
          </button>
        ) : props.cancelDenialReason === 'too_close' ? (
          <span data-testid="cancel-denied" className="text-muted-foreground text-xs italic">
            {props.copy.cancel.tooClose}
          </span>
        ) : null}
      </div>

      {showCancel ? (
        <CancelModal
          {...props}
          onClose={() => setShowCancel(false)}
          onSuccess={() => {
            setShowCancel(false);
            setResultMessage(props.copy.cancel.successBody);
            // After ~2s the page reload would be safer than mutating
            // local state — keeps the server data + cookie in sync.
            setTimeout(() => window.location.reload(), 1500);
          }}
        />
      ) : null}

      {showReschedule ? (
        <RescheduleModal
          {...props}
          onClose={() => setShowReschedule(false)}
          onSuccess={(newRef) => {
            setShowReschedule(false);
            setResultMessage(props.copy.reschedule.successBody);
            // Hard-navigate to the new reference so the new booking's
            // cookie + URL match.
            setTimeout(() => {
              window.location.href = props.manageHrefFactory(newRef);
            }, 1200);
          }}
        />
      ) : null}
    </div>
  );
}

function BookingSummary({ booking, locale, copy }: CustomerSelfServiceProps): React.ReactElement {
  const dt = new Date(booking.start_time);
  const dateStr = dt.toLocaleDateString(
    locale === 'nl' ? 'nl-NL' : locale === 'fr' ? 'fr-FR' : 'en-US',
    { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }
  );
  const timeStr = dt.toLocaleTimeString(
    locale === 'nl' ? 'nl-NL' : locale === 'fr' ? 'fr-FR' : 'en-US',
    { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }
  );
  const statusKey: BookingStatus = booking.status;

  return (
    <section
      data-testid="booking-summary"
      className="border-border bg-muted/20 rounded-lg border p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-muted-foreground font-mono text-xs uppercase">
          {copy.details.reference}
        </span>
        <span
          data-testid={`status-${statusKey}`}
          className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase ${
            statusKey === 'confirmed'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          }`}
        >
          {copy.status[statusKey]}
        </span>
      </div>
      <p data-testid="booking-reference" className="text-2xl font-bold tracking-wider">
        {booking.reference_code}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">{copy.details.date}</dt>
          <dd className="font-mono">{dateStr}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{copy.details.time}</dt>
          <dd className="font-mono">{timeStr}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{copy.details.party}</dt>
          <dd className="font-mono">{booking.party_size}</dd>
        </div>
      </dl>
      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">{copy.details.customer}</dt>
          <dd>
            {booking.customer_name}{' '}
            <span className="text-muted-foreground font-mono text-[10px]">
              ({booking.customer_email})
            </span>
          </dd>
        </div>
        {booking.notes ? (
          <div>
            <dt className="text-muted-foreground text-xs">{copy.details.notes}</dt>
            <dd className="text-sm">{booking.notes}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function CancelModal({
  booking,
  tenantSlug,
  copy,
  onClose,
  onSuccess,
}: CustomerSelfServiceProps & { onClose: () => void; onSuccess: () => void }): React.ReactElement {
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<SelfServiceError | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const r = await customerCancelBooking({
        tenantSlug,
        reference: booking.reference_code,
        reason: reason.trim() || null,
      });
      if (r.success) onSuccess();
      else setError(r.error ?? 'unknown_error');
    });
  }

  return (
    <div
      data-testid="cancel-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border-border w-full max-w-md space-y-3 rounded-lg border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{copy.cancel.confirmTitle}</h2>
        <p className="text-muted-foreground text-sm">{copy.cancel.confirmBody}</p>

        <label className="block text-sm">
          <span className="text-muted-foreground text-xs">{copy.cancel.reasonLabel}</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={copy.cancel.reasonPlaceholder}
            data-testid="cancel-reason"
            rows={3}
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>

        {error ? (
          <p
            data-testid="cancel-error"
            className="text-destructive ring-destructive/40 bg-destructive/10 rounded-md px-3 py-2 text-sm ring-1"
          >
            {copy.errors[error] ?? error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 text-sm ring-1"
          >
            {copy.cancel.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            data-testid="cancel-submit"
            className="bg-destructive text-destructive-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {copy.cancel.submit}
          </button>
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({
  booking,
  tenantSlug,
  rescheduleAvailability,
  copy,
  locale,
  onClose,
  onSuccess,
}: CustomerSelfServiceProps & {
  onClose: () => void;
  onSuccess: (newRef: string) => void;
}): React.ReactElement {
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pickedSlot, setPickedSlot] = useState<BookingSlot | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<SelfServiceError | null>(null);

  async function handlePickDate(d: PublicAvailabilityDay) {
    if (!d.isOpen) return;
    setDate(d.date);
    setPickedSlot(null);
    setLoadingSlots(true);
    try {
      const next = await fetchPublicSlots({
        tenantSlug,
        date: d.date,
        partySize: booking.party_size,
      });
      setSlots(next);
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleConfirm() {
    if (!pickedSlot) return;
    setError(null);
    startTransition(async () => {
      const r = await customerRescheduleBooking({
        tenantSlug,
        reference: booking.reference_code,
        newStartTime: pickedSlot.start_time,
      });
      if (r.success && r.newReference) onSuccess(r.newReference);
      else setError(r.error ?? 'unknown_error');
    });
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(
      locale === 'nl' ? 'nl-NL' : locale === 'fr' ? 'fr-FR' : 'en-US',
      { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }
    );
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(
      locale === 'nl' ? 'nl-NL' : locale === 'fr' ? 'fr-FR' : 'en-US',
      { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' }
    );

  return (
    <div
      data-testid="reschedule-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border-border w-full max-w-2xl space-y-4 rounded-lg border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{copy.reschedule.title}</h2>

        <section data-testid="reschedule-slot-picker">
          <p className="text-muted-foreground text-xs">{copy.reschedule.selectNewDate}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {rescheduleAvailability.map((d) => {
              const dt = new Date(`${d.date}T00:00:00.000Z`);
              const weekdayShort = copy.weekdayShort[dt.getUTCDay()];
              const dayMonth = dt.toLocaleDateString(
                locale === 'nl' ? 'nl-NL' : locale === 'fr' ? 'fr-FR' : 'en-US',
                { day: '2-digit', month: 'short', timeZone: 'UTC' }
              );
              const selected = date === d.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  data-testid={`reschedule-date-${d.date}`}
                  onClick={() => handlePickDate(d)}
                  disabled={!d.isOpen}
                  className={`flex flex-col items-center gap-1 rounded-md border p-2 text-center text-xs transition ${
                    d.isOpen
                      ? selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted'
                      : 'border-border bg-muted/30 text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  <span className="font-mono text-[10px] uppercase">{weekdayShort}</span>
                  <span className="text-sm font-semibold">{dayMonth}</span>
                  <span className="font-mono text-[10px]">
                    {d.isOpen ? `${d.slotsCount}` : copy.closedLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {date ? (
          <section>
            <p className="text-muted-foreground text-xs">{copy.reschedule.selectNewTime}</p>
            {loadingSlots ? (
              <p className="text-muted-foreground py-2 text-xs">…</p>
            ) : slots.length === 0 ? (
              <p data-testid="reschedule-no-slots" className="text-muted-foreground py-2 text-xs">
                {copy.noSlots}
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {slots.map((s) => (
                  <button
                    key={s.start_time}
                    type="button"
                    onClick={() => setPickedSlot(s)}
                    data-testid={`reschedule-slot-${fmtTime(s.start_time).replace(':', '')}`}
                    className={`flex flex-col items-center gap-1 rounded-md border p-2 transition ${
                      pickedSlot?.start_time === s.start_time
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted'
                    }`}
                  >
                    <span className="text-sm font-semibold">{fmtTime(s.start_time)}</span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {copy.spotsLeft.replace('{count}', String(s.capacity_remaining))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {pickedSlot ? (
          <p data-testid="reschedule-preview" className="bg-muted/40 rounded-md p-3 text-sm">
            {copy.reschedule.preview
              .replace('{oldDate}', fmtDate(booking.start_time))
              .replace('{oldTime}', fmtTime(booking.start_time))
              .replace('{newDate}', fmtDate(pickedSlot.start_time))
              .replace('{newTime}', fmtTime(pickedSlot.start_time))}
          </p>
        ) : null}

        {error ? (
          <p
            data-testid="reschedule-error"
            className="text-destructive ring-destructive/40 bg-destructive/10 rounded-md px-3 py-2 text-sm ring-1"
          >
            {copy.errors[error] ?? error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 text-sm ring-1"
          >
            {copy.reschedule.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending || !pickedSlot}
            data-testid="reschedule-submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {copy.reschedule.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelledView({
  booking,
  copy,
  locale,
  tenantSlug,
}: CustomerSelfServiceProps): React.ReactElement {
  const when = booking.cancelled_at
    ? new Date(booking.cancelled_at).toLocaleDateString(
        locale === 'nl' ? 'nl-NL' : locale === 'fr' ? 'fr-FR' : 'en-US',
        { day: '2-digit', month: 'long', year: 'numeric' }
      )
    : '';
  return (
    <section
      data-testid="cancelled-view"
      className="border-border bg-muted/20 rounded-lg border p-6 text-center"
    >
      <h2 className="text-xl font-semibold">{copy.cancelledView.title}</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        {copy.cancelledView.subtitle.replace('{date}', when)}
      </p>
      <a
        href={`/sites/${tenantSlug}/boek`}
        data-testid="new-booking-link"
        className="bg-primary text-primary-foreground mt-6 inline-block rounded-md px-4 py-2 text-sm"
      >
        {copy.cancelledView.newBooking}
      </a>
    </section>
  );
}

function PastView({
  booking,
  copy,
  locale,
  tenantSlug,
}: CustomerSelfServiceProps): React.ReactElement {
  const when = new Date(booking.start_time).toLocaleDateString(
    locale === 'nl' ? 'nl-NL' : locale === 'fr' ? 'fr-FR' : 'en-US',
    { day: '2-digit', month: 'long', year: 'numeric' }
  );
  return (
    <section
      data-testid="past-view"
      className="border-border bg-muted/20 rounded-lg border p-6 text-center"
    >
      <h2 className="text-xl font-semibold">{copy.pastView.title}</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        {copy.pastView.subtitle.replace('{date}', when)}
      </p>
      <a
        href={`/sites/${tenantSlug}/boek`}
        data-testid="new-booking-link"
        className="bg-primary text-primary-foreground mt-6 inline-block rounded-md px-4 py-2 text-sm"
      >
        {copy.pastView.newBooking}
      </a>
    </section>
  );
}
