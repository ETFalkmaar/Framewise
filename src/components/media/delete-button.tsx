'use client';

import { useState, useTransition } from 'react';

import { deleteMediaAction } from '@/app/(i18n)/[locale]/(auth-required)/account/site/media/actions';

export interface DeleteButtonProps {
  mediaId: string;
  copy: {
    cta: string;
    confirm: string;
  };
}

/**
 * Soft-delete trigger for a single media row in the library
 * grid (step 42). Uses `window.confirm` for the destructive
 * gate — production swap to a styled dialog lives in step 88.
 */
export function DeleteButton({ mediaId, copy }: DeleteButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        data-testid={`delete-media-${mediaId}`}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(copy.confirm)) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteMediaAction(mediaId);
            if (!result.success) setError(result.error ?? 'Verwijderen mislukt');
          });
        }}
        className="text-destructive hover:bg-destructive/10 rounded-md px-2 py-1 font-mono text-[10px] disabled:opacity-50"
      >
        🗑 {copy.cta}
      </button>
      {error && (
        <p data-testid={`delete-error-${mediaId}`} className="text-destructive text-[10px]">
          {error}
        </p>
      )}
    </>
  );
}
