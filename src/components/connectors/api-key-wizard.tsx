'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Link } from '@/i18n/navigation';
import type { ApiKeyField } from '@/lib/connectors';

export interface ApiKeyWizardProps {
  providerId: string;
  fields: ApiKeyField[];
  instructions: string;
  helpUrl?: string;
  locale: 'nl' | 'fr' | 'en';
  copy: {
    title: string;
    submit: string;
    submitting: string;
    testing: string;
    success: string;
    successHint: string;
    testFailed: string;
    fieldRequired: string;
    helpLinkLabel: string;
    cancel: string;
  };
  /** Where to send the user after a successful connection. */
  successHref?: string;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Multi-step API-key wizard. Renders the localized instructions, the
 * fields declared in `connector.apiKey.fields`, then submits to
 * `POST /api/connectors/api-key/connect`. On success the user is
 * redirected to `successHref` (defaults to `/account/connections`).
 */
export function ApiKeyWizard({
  providerId,
  fields,
  instructions,
  helpUrl,
  locale: _locale,
  copy,
  successHref = '/account/connections',
}: ApiKeyWizardProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, '']))
  );
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);

    // Client-side required-field check so the user sees the issue
    // immediately instead of via the server's MissingFieldError.
    for (const f of fields) {
      const v = values[f.key]?.trim() ?? '';
      if (f.required && v.length === 0) {
        setStatus('error');
        setError(`${copy.fieldRequired} – ${f.key}`);
        return;
      }
    }

    try {
      const res = await fetch('/api/connectors/api-key/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, credentials: values }),
        credentials: 'include',
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        details?: { fieldKey?: string };
      };
      if (!res.ok) {
        const message =
          body.code === 'MISSING_FIELD' && body.details?.fieldKey
            ? `${copy.fieldRequired} – ${body.details.fieldKey}`
            : (body.error ?? copy.testFailed);
        setStatus('error');
        setError(message);
        return;
      }
      setStatus('success');
      // Hard navigation so the connections page re-fetches server data.
      window.setTimeout(() => router.push(successHref), 800);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : copy.testFailed);
    }
  }

  const submitting = status === 'submitting';
  const success = status === 'success';

  return (
    <form
      onSubmit={onSubmit}
      data-testid={`api-key-wizard-${providerId}`}
      data-status={status}
      className="space-y-6"
    >
      <section className="border-border bg-muted/40 space-y-2 rounded-lg border p-4 text-sm">
        <p className="font-medium">{copy.title}</p>
        <p className="text-muted-foreground text-xs whitespace-pre-line">{instructions}</p>
        {helpUrl && (
          <p className="text-xs">
            <a
              href={helpUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground underline"
            >
              {copy.helpLinkLabel} ↗
            </a>
          </p>
        )}
      </section>

      <fieldset className="space-y-4" disabled={submitting || success}>
        {fields.map((f) => (
          <label key={f.key} className="block space-y-1.5 text-xs">
            <span className="text-foreground block font-mono">
              {f.key}
              {f.required ? <span className="text-destructive"> *</span> : null}
            </span>
            <input
              type={f.type === 'password' ? 'password' : 'text'}
              name={f.key}
              value={values[f.key] ?? ''}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
              required={f.required}
              minLength={f.validation?.minLength}
              maxLength={f.validation?.maxLength}
              pattern={f.validation?.pattern}
              data-testid={`api-key-field-${f.key}`}
              className="border-border bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
            />
          </label>
        ))}
      </fieldset>

      {error && status === 'error' && (
        <p
          data-testid="api-key-error"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-xs"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          data-testid="api-key-success"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"
        >
          ✓ {copy.success} — {copy.successHint}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={submitting || success}
          data-testid="api-key-submit"
          className="bg-primary text-primary-foreground inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? copy.submitting : success ? copy.success : copy.submit}
        </button>
        <Link
          href="/account/connections/add"
          className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-xs underline"
        >
          {copy.cancel}
        </Link>
      </div>
    </form>
  );
}
