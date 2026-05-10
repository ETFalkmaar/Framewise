'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface DisconnectButtonProps {
  connectionId: string;
  copy: {
    confirm: string;
    button: string;
    pending: string;
    failed: string;
  };
}

/**
 * "Verbinding verbreken" button for the connections page. Uses
 * `window.confirm` for the confirmation prompt to avoid pulling in a
 * dialog primitive — step 14 keeps the surface minimal.
 */
export function DisconnectButton({ connectionId, copy }: DisconnectButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    if (!window.confirm(copy.confirm)) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/connectors/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? copy.failed);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={disconnect}
        disabled={pending}
        data-testid={`disconnect-${connectionId}`}
        className="ring-border bg-background hover:bg-muted rounded-md px-2 py-1 font-mono text-[10px] ring-1 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? copy.pending : `↩ ${copy.button}`}
      </button>
      {error && <p className="text-destructive font-mono text-[10px]">{error}</p>}
    </div>
  );
}
