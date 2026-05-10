'use client';

import { useState } from 'react';

export interface OAuthButtonProps {
  providerId: string;
  copy: {
    start: string;
    starting: string;
    failed: string;
  };
}

/**
 * Triggers the OAuth flow on click. Calls `POST /api/connectors/oauth/start`,
 * then redirects the browser to the returned `authorizeUrl`. The cookie
 * for state validation is set by the server response.
 */
export function OAuthButton({ providerId, copy }: OAuthButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/connectors/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Failed to start OAuth flow');
      }
      const body = (await res.json()) as { authorizeUrl: string };
      window.location.href = body.authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed);
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={start}
        disabled={pending}
        data-testid={`oauth-start-${providerId}`}
        className="bg-primary text-primary-foreground inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        🔐 {pending ? copy.starting : copy.start}
      </button>
      {error && (
        <p
          data-testid="oauth-error"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-xs"
        >
          {error}
        </p>
      )}
    </div>
  );
}
