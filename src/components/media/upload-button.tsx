'use client';

import { useRef, useState, useTransition } from 'react';

import type { Media } from '@/types/database';

import { uploadMediaAction } from '@/app/(i18n)/[locale]/(auth-required)/account/site/media/actions';

interface UploadButtonCopy {
  cta: string;
  uploading: string;
}

export interface UploadButtonProps {
  copy: UploadButtonCopy;
  onUploaded?: (media: Media) => void;
}

/**
 * File-picker trigger for the customer-facing media library
 * (step 42). The actual `<input type="file">` stays hidden — the
 * styled button forwards the click. The server action
 * `uploadMediaAction` does the heavy lifting (permission gate,
 * mime/size validation, storage upload, mediaRepo write).
 *
 * The `onUploaded` callback is used by the picker modal: when
 * the user uploads inside the picker we want to immediately
 * select the new asset without a full page revalidation.
 */
export function UploadButton({ copy, onUploaded }: UploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div data-testid="upload-section">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        data-testid="upload-file-input"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.append('file', file);
          setError(null);
          startTransition(async () => {
            const result = await uploadMediaAction(fd);
            if (!result.success) {
              setError(result.error ?? 'Upload mislukt');
            } else if (result.media) {
              onUploaded?.(result.media);
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
          });
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={pending}
        data-testid="upload-trigger"
        className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 font-mono text-xs disabled:opacity-50"
      >
        {pending ? `⏳ ${copy.uploading}` : `+ ${copy.cta}`}
      </button>
      {error && (
        <p data-testid="upload-error" className="text-destructive mt-2 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
