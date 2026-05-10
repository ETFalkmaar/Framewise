'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

import { getTranslatedString } from '@/lib/public-site/locale-fallback';
import type {
  ContactBlock as ContactBlockType,
  ContactFormField,
  Locale,
} from '@/lib/blocks/types';

type FieldConfig = {
  type: 'text' | 'email' | 'tel' | 'textarea';
  required: boolean;
  autoComplete?: string;
};

const FIELD_CONFIG: Record<ContactFormField, FieldConfig> = {
  name: { type: 'text', required: true, autoComplete: 'name' },
  email: { type: 'email', required: true, autoComplete: 'email' },
  phone: { type: 'tel', required: false, autoComplete: 'tel' },
  subject: { type: 'text', required: false, autoComplete: 'off' },
  message: { type: 'textarea', required: true, autoComplete: 'off' },
};

const FIELD_LABELS: Record<Locale, Record<ContactFormField, string>> = {
  nl: {
    name: 'Naam',
    email: 'E-mail',
    phone: 'Telefoon',
    subject: 'Onderwerp',
    message: 'Bericht',
  },
  fr: { name: 'Nom', email: 'E-mail', phone: 'Téléphone', subject: 'Objet', message: 'Message' },
  en: {
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    subject: 'Subject',
    message: 'Message',
  },
};

const SENDING_LABEL: Record<Locale, string> = {
  nl: 'Versturen…',
  fr: 'Envoi…',
  en: 'Sending…',
};

/**
 * Contact form. Client component because it owns local form state +
 * submission status. Fields are configurable via
 * `block.props.fields` — only the fields you list are rendered.
 *
 * MVP behaviour: on submit, the data is logged to the console and a
 * translated success message replaces the form. Real mail
 * submission lands in step 54 via Resend (the `recipient_email`
 * prop is already plumbed through and persisted on the connection).
 *
 * Spam protection: a hidden `website` honeypot field is included.
 * Bots fill it; humans don't see it. Submissions with a non-empty
 * honeypot are silently swallowed (we still show "success" so the
 * bot doesn't learn the trick).
 */
export function ContactBlock({
  block,
  locale,
  defaultLocale,
}: {
  block: ContactBlockType;
  locale: Locale;
  defaultLocale: Locale;
}): React.JSX.Element {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle');

  const headline = getTranslatedString(block.props.headline_translations, locale, defaultLocale);
  const subheadline = getTranslatedString(
    block.props.subheadline_translations,
    locale,
    defaultLocale
  );
  const submitText = getTranslatedString(
    block.props.submit_text_translations,
    locale,
    defaultLocale
  );
  const successMessage = getTranslatedString(
    block.props.success_message_translations,
    locale,
    defaultLocale
  );
  const labels = FIELD_LABELS[locale] ?? FIELD_LABELS[defaultLocale] ?? FIELD_LABELS.en;
  const sendingLabel = SENDING_LABEL[locale] ?? SENDING_LABEL[defaultLocale] ?? SENDING_LABEL.en;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus('submitting');
    const formData = new FormData(event.currentTarget);
    const honeypot = formData.get('website');

    // Honeypot check: real users never see this field.
    if (typeof honeypot === 'string' && honeypot.length > 0) {
      // Pretend success — don't tip the bot off.
      setStatus('submitted');
      return;
    }

    const payload = Object.fromEntries(formData.entries());
    // Step 54 will swap this for a fetch to /api/contact-form. For
    // now: log + simulate latency + show success.
    console.log('[contact-form]', {
      block_id: block.id,
      recipient_email: block.props.recipient_email ?? '(not configured)',
      payload,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    setStatus('submitted');
  }

  return (
    <section data-testid={`contact-block-${block.id}`} className="w-full px-6 py-16">
      <div className="mx-auto max-w-2xl">
        {(headline || subheadline) && (
          <header className="mb-8 text-center">
            {headline && (
              <h2
                data-testid="contact-block-headline"
                className="text-display-md font-bold tracking-tight"
              >
                {headline}
              </h2>
            )}
            {subheadline && <p className="text-muted-foreground mt-3 text-base">{subheadline}</p>}
          </header>
        )}

        {status === 'submitted' ? (
          <div
            data-testid="contact-form-success"
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-6 text-center text-sm text-emerald-700 dark:text-emerald-300"
          >
            {successMessage}
          </div>
        ) : (
          <form
            data-testid="contact-form"
            onSubmit={handleSubmit}
            className="space-y-4"
            noValidate={false}
          >
            {/* Honeypot — hidden from users, irresistible to bots. */}
            <div aria-hidden="true" className="absolute left-[-10000px] h-0 w-0 overflow-hidden">
              <label htmlFor={`hp-${block.id}`}>Leave this field empty</label>
              <input
                id={`hp-${block.id}`}
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {block.props.fields.map((field) => {
              const cfg = FIELD_CONFIG[field];
              const label = labels[field];
              const fieldId = `${block.id}-${field}`;
              return (
                <div key={field} data-testid={`contact-field-${field}`} className="space-y-1.5">
                  <label htmlFor={fieldId} className="text-foreground block text-sm font-medium">
                    {label}
                    {cfg.required && (
                      <span className="text-destructive ml-1" aria-hidden="true">
                        *
                      </span>
                    )}
                  </label>
                  {cfg.type === 'textarea' ? (
                    <textarea
                      id={fieldId}
                      name={field}
                      required={cfg.required}
                      rows={5}
                      autoComplete={cfg.autoComplete}
                      className="border-border bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    />
                  ) : (
                    <input
                      id={fieldId}
                      name={field}
                      type={cfg.type}
                      required={cfg.required}
                      autoComplete={cfg.autoComplete}
                      className="border-border bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    />
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={status === 'submitting'}
              data-testid="contact-form-submit"
              className={cn(
                'bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg px-6 text-base font-medium transition-colors',
                status === 'submitting' && 'cursor-not-allowed opacity-70'
              )}
            >
              {status === 'submitting' ? sendingLabel : submitText}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
