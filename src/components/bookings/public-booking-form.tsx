'use client';

import { useState, useTransition } from 'react';

import {
  createPublicBooking,
  fetchPublicSlots,
  type CreatePublicBookingError,
} from '@/app/(i18n)/[locale]/sites/[slug]/boek/actions';
import type { PublicAvailabilityDay } from '@/lib/bookings/public-availability';
import type { BookingSlot } from '@/lib/bookings/slot-generator';

export interface PublicBookingFormCopy {
  title: string;
  subtitle: string;
  step1Title: string;
  step2Title: string;
  step3Title: string;
  step4Title: string;
  step5Title: string;
  back: string;
  next: string;
  submit: string;
  submitting: string;
  datePicker: {
    fullyBooked: string;
    closed: string;
    slotsAvailable: string;
  };
  slotPicker: {
    noSlots: string;
    spotsLeft: string;
  };
  partySize: {
    label: string;
    person: string;
    people: string;
  };
  contactForm: {
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    emailHint: string;
    phone: string;
    phonePlaceholder: string;
    notes: string;
    notesPlaceholder: string;
  };
  confirmation: {
    headline: string;
    subheadline: string;
    reference: string;
    dateLabel: string;
    timeLabel: string;
    partyLabel: string;
    newBooking: string;
  };
  errors: Record<CreatePublicBookingError, string>;
  /** Names indexed 0-6 (Sun..Sat). */
  weekdayShort: string[];
}

export interface PublicBookingFormProps {
  tenantSlug: string;
  availability: PublicAvailabilityDay[];
  copy: PublicBookingFormCopy;
  /** BCP-47 locale tag, used for date / time formatting. */
  locale: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

/**
 * Multi-step booking form (step 51). Five linear steps, no router
 * jumps — keeps the implementation simple and avoids cluttering the
 * tenant's URL with `?step=` params. Each step is rendered inline so
 * keyboard tab-order survives across transitions.
 */
export function PublicBookingForm({
  tenantSlug,
  availability,
  copy,
  locale,
}: PublicBookingFormProps): React.ReactElement {
  const [step, setStep] = useState<Step>(1);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [slot, setSlot] = useState<BookingSlot | null>(null);
  const [partySize, setPartySize] = useState<number>(2);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<CreatePublicBookingError | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handlePickDate(d: PublicAvailabilityDay) {
    if (!d.isOpen) return;
    setDate(d.date);
    setSlot(null);
    setLoadingSlots(true);
    try {
      const fetched = await fetchPublicSlots({
        tenantSlug,
        date: d.date,
        partySize,
      });
      setSlots(fetched);
      setStep(2);
    } finally {
      setLoadingSlots(false);
    }
  }

  function handlePickSlot(s: BookingSlot) {
    setSlot(s);
    setStep(3);
  }

  function handleSubmit() {
    if (!slot) return;
    setError(null);
    const honeypot = (document.getElementById('public-booking-honeypot') as HTMLInputElement | null)
      ?.value;
    startTransition(async () => {
      const result = await createPublicBooking({
        tenantSlug,
        customer_name: name,
        customer_email: email,
        customer_phone: phone || null,
        party_size: partySize,
        start_time: slot.start_time,
        notes: notes || null,
        honeypot: honeypot ?? null,
      });
      if (result.success && result.bookingReference) {
        setReference(result.bookingReference);
        setStep(5);
      } else {
        setError(result.error ?? 'unknown_error');
      }
    });
  }

  function handleReset() {
    setStep(1);
    setDate(null);
    setSlots([]);
    setSlot(null);
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setReference(null);
    setError(null);
  }

  return (
    <div data-testid="public-booking-form" className="mx-auto max-w-2xl">
      <StepIndicator step={step} />

      {step === 1 && (
        <DateStep
          copy={copy}
          availability={availability}
          loading={loadingSlots}
          onPick={handlePickDate}
          locale={locale}
        />
      )}

      {step === 2 && date && (
        <SlotStep
          copy={copy}
          date={date}
          slots={slots}
          locale={locale}
          onPick={handlePickSlot}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && slot && date && (
        <PartySizeStep
          copy={copy}
          partySize={partySize}
          onChange={setPartySize}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && slot && (
        <ContactStep
          copy={copy}
          name={name}
          email={email}
          phone={phone}
          notes={notes}
          error={error}
          pending={pending}
          onChange={{ setName, setEmail, setPhone, setNotes }}
          onSubmit={handleSubmit}
          onBack={() => setStep(3)}
        />
      )}

      {step === 5 && reference && slot && date && (
        <ConfirmationStep
          copy={copy}
          reference={reference}
          slot={slot}
          partySize={partySize}
          locale={locale}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

/** Numbered breadcrumb across the top so the visitor always sees progress. */
function StepIndicator({ step }: { step: Step }): React.ReactElement {
  return (
    <ol
      data-testid="booking-step-indicator"
      className="text-muted-foreground mb-6 flex items-center gap-2 font-mono text-xs"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <li
          key={n}
          data-testid={`booking-step-${n}-marker`}
          className={`flex items-center gap-2 ${n === step ? 'text-foreground font-semibold' : ''}`}
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
              n <= step ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            {n}
          </span>
          {n < 5 ? <span aria-hidden>›</span> : null}
        </li>
      ))}
    </ol>
  );
}

function DateStep({
  copy,
  availability,
  loading,
  onPick,
  locale,
}: {
  copy: PublicBookingFormCopy;
  availability: PublicAvailabilityDay[];
  loading: boolean;
  onPick: (d: PublicAvailabilityDay) => void;
  locale: string;
}): React.ReactElement {
  return (
    <section data-testid="booking-step-1">
      <h2 className="text-xl font-semibold">{copy.step1Title}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{copy.subtitle}</p>
      <div
        data-testid="booking-date-picker"
        className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7"
      >
        {availability.map((d) => {
          const dt = new Date(`${d.date}T00:00:00.000Z`);
          const weekdayShort = copy.weekdayShort[dt.getUTCDay()];
          const dayMonth = dt.toLocaleDateString(locale, {
            day: '2-digit',
            month: 'short',
            timeZone: 'UTC',
          });
          return (
            <button
              key={d.date}
              type="button"
              data-testid={`booking-date-${d.date}`}
              data-open={d.isOpen}
              onClick={() => onPick(d)}
              disabled={!d.isOpen || loading}
              className={`flex flex-col items-center gap-1 rounded-md border p-3 text-center text-sm transition ${
                d.isOpen
                  ? 'border-border bg-background hover:bg-muted cursor-pointer'
                  : 'border-border bg-muted/30 text-muted-foreground cursor-not-allowed'
              }`}
            >
              <span className="font-mono text-[10px] uppercase">{weekdayShort}</span>
              <span className="text-base font-semibold">{dayMonth}</span>
              <span className="font-mono text-[10px]">
                {d.isOpen
                  ? copy.datePicker.slotsAvailable.replace('{count}', String(d.slotsCount))
                  : copy.datePicker.closed}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SlotStep({
  copy,
  date,
  slots,
  locale,
  onPick,
  onBack,
}: {
  copy: PublicBookingFormCopy;
  date: string;
  slots: BookingSlot[];
  locale: string;
  onPick: (s: BookingSlot) => void;
  onBack: () => void;
}): React.ReactElement {
  const heading = new Date(`${date}T00:00:00.000Z`).toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'UTC',
  });

  return (
    <section data-testid="booking-step-2">
      <h2 className="text-xl font-semibold">{copy.step2Title}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{heading}</p>

      {slots.length === 0 ? (
        <p data-testid="booking-no-slots" className="py-8 text-center text-sm">
          {copy.slotPicker.noSlots}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {slots.map((s) => {
            const t = new Date(s.start_time).toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'UTC',
            });
            return (
              <button
                key={s.start_time}
                type="button"
                data-testid={`booking-slot-${t.replace(':', '')}`}
                onClick={() => onPick(s)}
                className="border-border bg-background hover:bg-muted flex flex-col items-center gap-1 rounded-md border p-3 transition"
              >
                <span className="text-base font-semibold">{t}</span>
                <span className="text-muted-foreground font-mono text-[10px]">
                  {copy.slotPicker.spotsLeft.replace('{count}', String(s.capacity_remaining))}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <NavRow back={copy.back} onBack={onBack} />
    </section>
  );
}

function PartySizeStep({
  copy,
  partySize,
  onChange,
  onNext,
  onBack,
}: {
  copy: PublicBookingFormCopy;
  partySize: number;
  onChange: (n: number) => void;
  onNext: () => void;
  onBack: () => void;
}): React.ReactElement {
  return (
    <section data-testid="booking-step-3">
      <h2 className="text-xl font-semibold">{copy.step3Title}</h2>
      <div className="mt-6 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            type="button"
            data-testid={`booking-party-${n}`}
            onClick={() => onChange(n)}
            className={`min-w-[3rem] rounded-md border p-3 text-sm transition ${
              partySize === n
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        {partySize === 1
          ? copy.partySize.person
          : copy.partySize.people.replace('{count}', String(partySize))}
      </p>
      <NavRow
        back={copy.back}
        next={copy.next}
        onBack={onBack}
        onNext={onNext}
        nextDisabled={partySize < 1}
      />
    </section>
  );
}

function ContactStep({
  copy,
  name,
  email,
  phone,
  notes,
  error,
  pending,
  onChange,
  onSubmit,
  onBack,
}: {
  copy: PublicBookingFormCopy;
  name: string;
  email: string;
  phone: string;
  notes: string;
  error: CreatePublicBookingError | null;
  pending: boolean;
  onChange: {
    setName: (v: string) => void;
    setEmail: (v: string) => void;
    setPhone: (v: string) => void;
    setNotes: (v: string) => void;
  };
  onSubmit: () => void;
  onBack: () => void;
}): React.ReactElement {
  const canSubmit = name.trim().length >= 2 && /.+@.+\..+/.test(email);
  return (
    <section data-testid="booking-step-4">
      <h2 className="text-xl font-semibold">{copy.step4Title}</h2>
      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        {/* Honeypot — bots fill it, humans don't see it. */}
        <input
          id="public-booking-honeypot"
          name="honeypot"
          type="text"
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          className="absolute -left-[10000px] h-0 w-0 opacity-0"
        />
        <label className="block text-sm">
          <span className="text-muted-foreground text-xs">{copy.contactForm.name}</span>
          <input
            value={name}
            onChange={(e) => onChange.setName(e.target.value)}
            placeholder={copy.contactForm.namePlaceholder}
            data-testid="booking-name-input"
            required
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground text-xs">{copy.contactForm.email}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => onChange.setEmail(e.target.value)}
            placeholder={copy.contactForm.emailPlaceholder}
            data-testid="booking-email-input"
            required
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
          <span className="text-muted-foreground mt-1 block text-[10px]">
            {copy.contactForm.emailHint}
          </span>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground text-xs">{copy.contactForm.phone}</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onChange.setPhone(e.target.value)}
            placeholder={copy.contactForm.phonePlaceholder}
            data-testid="booking-phone-input"
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground text-xs">{copy.contactForm.notes}</span>
          <textarea
            value={notes}
            onChange={(e) => onChange.setNotes(e.target.value)}
            placeholder={copy.contactForm.notesPlaceholder}
            data-testid="booking-notes-input"
            rows={3}
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>

        {error ? (
          <p
            data-testid="booking-form-error"
            className="text-destructive ring-destructive/40 bg-destructive/10 rounded-md px-3 py-2 text-sm ring-1"
          >
            {copy.errors[error] ?? copy.errors.unknown_error}
          </p>
        ) : null}

        <NavRow
          back={copy.back}
          next={pending ? copy.submitting : copy.submit}
          onBack={onBack}
          onNext={() => {
            if (canSubmit) onSubmit();
          }}
          nextTestId="booking-submit"
          nextDisabled={!canSubmit || pending}
        />
      </form>
    </section>
  );
}

function ConfirmationStep({
  copy,
  reference,
  slot,
  partySize,
  locale,
  onReset,
}: {
  copy: PublicBookingFormCopy;
  reference: string;
  slot: BookingSlot;
  partySize: number;
  locale: string;
  onReset: () => void;
}): React.ReactElement {
  const dt = new Date(slot.start_time);
  const dateStr = dt.toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const timeStr = dt.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  return (
    <section
      data-testid="booking-step-5"
      className="border-border bg-muted/30 rounded-lg border p-6 text-center"
    >
      <h2 className="text-2xl font-bold">{copy.confirmation.headline}</h2>
      <p className="text-muted-foreground mt-2 text-sm">{copy.confirmation.subheadline}</p>
      <div className="my-6 inline-block rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-left">
        <span className="text-muted-foreground block font-mono text-[10px] uppercase">
          {copy.confirmation.reference}
        </span>
        <span data-testid="booking-reference" className="text-xl font-bold tracking-wider">
          {reference}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">{copy.confirmation.dateLabel}</dt>
          <dd className="font-mono">{dateStr}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{copy.confirmation.timeLabel}</dt>
          <dd className="font-mono">{timeStr}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{copy.confirmation.partyLabel}</dt>
          <dd className="font-mono">{partySize}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onReset}
        data-testid="booking-new"
        className="ring-border bg-background hover:bg-muted mt-6 rounded-md px-4 py-2 text-sm ring-1"
      >
        {copy.confirmation.newBooking}
      </button>
    </section>
  );
}

function NavRow({
  back,
  next,
  onBack,
  onNext,
  nextDisabled,
  nextTestId,
}: {
  back: string;
  next?: string;
  onBack: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextTestId?: string;
}): React.ReactElement {
  return (
    <div className="mt-6 flex justify-between gap-2">
      <button
        type="button"
        onClick={onBack}
        data-testid="booking-back"
        className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 text-sm ring-1"
      >
        ← {back}
      </button>
      {next && onNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          data-testid={nextTestId ?? 'booking-next'}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
        >
          {next}
        </button>
      ) : null}
    </div>
  );
}
