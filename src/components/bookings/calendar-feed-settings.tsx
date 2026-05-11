'use client';

import { useState, useTransition } from 'react';

import {
  generateCalendarFeedToken,
  revokeCalendarFeedToken,
  rotateCalendarFeedToken,
} from '@/app/(i18n)/[locale]/(auth-required)/account/bookings/calendar/actions';

export interface CalendarFeedSettingsCopy {
  noToken: string;
  generateButton: string;
  feedUrlLabel: string;
  copyButton: string;
  copied: string;
  instructionsTitle: string;
  instructionsGoogle: string;
  instructionsApple: string;
  instructionsOutlook: string;
  rotate: string;
  rotateConfirm: string;
  revoke: string;
  revokeConfirm: string;
  errorGeneric: string;
}

export interface CalendarFeedSettingsProps {
  /** Existing token, or `null` to show the empty-state generate flow. */
  initialToken: string | null;
  /** Base URL for the feed (without the token). */
  feedUrlBase: string;
  copy: CalendarFeedSettingsCopy;
}

/**
 * Client wrapper around the calendar-feed token actions. Handles the
 * three lifecycle transitions (generate / rotate / revoke) with
 * window.confirm() guards on destructive paths, plus a one-click
 * copy-to-clipboard button on the feed URL.
 */
export function CalendarFeedSettings({
  initialToken,
  feedUrlBase,
  copy,
}: CalendarFeedSettingsProps): React.ReactElement {
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const feedUrl = token ? `${feedUrlBase}?token=${token}` : '';

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const r = await generateCalendarFeedToken();
      if (r.success && r.token) setToken(r.token);
      else setError(r.error ?? copy.errorGeneric);
    });
  }

  function handleRotate() {
    if (!window.confirm(copy.rotateConfirm)) return;
    setError(null);
    startTransition(async () => {
      const r = await rotateCalendarFeedToken();
      if (r.success && r.token) setToken(r.token);
      else setError(r.error ?? copy.errorGeneric);
    });
  }

  function handleRevoke() {
    if (!window.confirm(copy.revokeConfirm)) return;
    setError(null);
    startTransition(async () => {
      const r = await revokeCalendarFeedToken();
      if (r.success) setToken(null);
      else setError(r.error ?? copy.errorGeneric);
    });
  }

  async function handleCopy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard failure is non-fatal */
    }
  }

  if (!token) {
    return (
      <section data-testid="calendar-feed-empty" className="space-y-4">
        <p className="text-muted-foreground text-sm">{copy.noToken}</p>
        {error ? (
          <p
            data-testid="calendar-feed-error"
            className="text-destructive ring-destructive/40 bg-destructive/10 rounded-md px-3 py-2 text-sm ring-1"
          >
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          data-testid="generate-token-button"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
        >
          {copy.generateButton}
        </button>
      </section>
    );
  }

  return (
    <section data-testid="calendar-feed-active" className="space-y-4">
      <div>
        <p className="text-muted-foreground font-mono text-xs uppercase">{copy.feedUrlLabel}</p>
        <div className="bg-muted/40 mt-1 flex items-center gap-2 rounded-md p-3">
          <code data-testid="calendar-feed-url" className="flex-1 font-mono text-xs break-all">
            {feedUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            data-testid="copy-feed-url"
            className="ring-border bg-background hover:bg-muted shrink-0 rounded-md px-3 py-1.5 font-mono text-xs ring-1"
          >
            {copied ? copy.copied : copy.copyButton}
          </button>
        </div>
      </div>

      <details className="border-border rounded-md border p-3 text-sm">
        <summary className="cursor-pointer font-medium">{copy.instructionsTitle}</summary>
        <ul className="text-muted-foreground mt-3 space-y-2 text-xs">
          <li>{copy.instructionsGoogle}</li>
          <li>{copy.instructionsApple}</li>
          <li>{copy.instructionsOutlook}</li>
        </ul>
      </details>

      {error ? (
        <p
          data-testid="calendar-feed-error"
          className="text-destructive ring-destructive/40 bg-destructive/10 rounded-md px-3 py-2 text-sm ring-1"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRotate}
          disabled={pending}
          data-testid="rotate-token-button"
          className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 text-sm ring-1 disabled:opacity-50"
        >
          {copy.rotate}
        </button>
        <button
          type="button"
          onClick={handleRevoke}
          disabled={pending}
          data-testid="revoke-token-button"
          className="ring-destructive/40 text-destructive hover:bg-destructive/10 rounded-md px-4 py-2 text-sm ring-1 disabled:opacity-50"
        >
          {copy.revoke}
        </button>
      </div>
    </section>
  );
}
