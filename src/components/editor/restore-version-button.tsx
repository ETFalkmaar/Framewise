'use client';

import { useState, useTransition } from 'react';

import { restoreVersionAction } from '@/app/(i18n)/[locale]/(auth-required)/account/site/pages/[pageId]/history/actions';

export interface RestoreVersionButtonProps {
  pageId: string;
  versionId: string;
  copy: {
    cta: string;
    confirm: string;
    restoring: string;
    restored: string;
  };
}

/**
 * Confirms + fires the restore-version server action. Lives as a
 * tiny client island so the history page itself can stay an RSC
 * (cookie-aware data fetching upstream).
 */
export function RestoreVersionButton({ pageId, versionId, copy }: RestoreVersionButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <>
      <button
        type="button"
        data-testid={`restore-version-${versionId}`}
        disabled={pending || done}
        onClick={() => {
          if (!window.confirm(copy.confirm)) return;
          setError(null);
          startTransition(async () => {
            const result = await restoreVersionAction({ pageId, versionId });
            if (!result.success) setError(result.error ?? 'Onbekende fout');
            else setDone(true);
          });
        }}
        className="ring-border bg-background hover:bg-muted inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition disabled:opacity-50"
      >
        {pending ? copy.restoring : done ? `✓ ${copy.restored}` : copy.cta}
      </button>
      {error && (
        <p data-testid={`restore-error-${versionId}`} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </>
  );
}
