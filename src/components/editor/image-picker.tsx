'use client';

import { useState } from 'react';

import { UploadButton } from '@/components/media/upload-button';
import type { Media } from '@/types/database';

interface ImagePickerCopy {
  title: string;
  tabExisting: string;
  tabUpload: string;
  empty: string;
  cancel: string;
  upload: string;
  uploading: string;
}

export interface ImagePickerProps {
  initial: Media[];
  onSelect: (url: string, alt?: string) => void;
  onClose: () => void;
  copy: ImagePickerCopy;
}

/**
 * Modal picker that lets a block-edit form attach a media item
 * to itself (step 42). Two tabs — pick an existing asset, or
 * upload a new one and select it in one go. The newly uploaded
 * item is appended to local state so the user sees it right
 * away (the parent page revalidates on next navigation).
 */
export function ImagePicker({ initial, onSelect, onClose, copy }: ImagePickerProps) {
  const [items, setItems] = useState<Media[]>(initial);
  const [tab, setTab] = useState<'existing' | 'upload'>('existing');

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="image-picker"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border-border w-full max-w-3xl rounded-lg border p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{copy.title}</h3>
          <button
            type="button"
            data-testid="image-picker-close"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground font-mono text-sm"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            data-testid="image-picker-tab-existing"
            data-active={tab === 'existing' ? 'true' : 'false'}
            onClick={() => setTab('existing')}
            className={`rounded-md px-3 py-1.5 font-mono text-xs ${
              tab === 'existing' ? 'bg-muted text-foreground' : 'text-muted-foreground'
            }`}
          >
            {copy.tabExisting}
          </button>
          <button
            type="button"
            data-testid="image-picker-tab-upload"
            data-active={tab === 'upload' ? 'true' : 'false'}
            onClick={() => setTab('upload')}
            className={`rounded-md px-3 py-1.5 font-mono text-xs ${
              tab === 'upload' ? 'bg-muted text-foreground' : 'text-muted-foreground'
            }`}
          >
            {copy.tabUpload}
          </button>
        </div>

        {tab === 'existing' ? (
          items.length === 0 ? (
            <p
              data-testid="image-picker-empty"
              className="text-muted-foreground py-8 text-center text-xs"
            >
              {copy.empty}
            </p>
          ) : (
            <ul className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto md:grid-cols-4">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    data-testid={`image-picker-item-${item.id}`}
                    onClick={() => onSelect(item.public_url, item.alt_text.nl ?? item.file_name)}
                    className="hover:ring-primary group block w-full overflow-hidden rounded-md ring-1 ring-transparent"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.public_url}
                      alt={item.alt_text.nl ?? item.file_name}
                      className="aspect-square w-full object-cover"
                    />
                    <span className="text-muted-foreground block truncate p-1 text-left font-mono text-[10px]">
                      {item.file_name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div data-testid="image-picker-upload-pane" className="py-6 text-center">
            <UploadButton
              copy={{ cta: copy.upload, uploading: copy.uploading }}
              onUploaded={(media) => {
                setItems((prev) => [media, ...prev]);
                onSelect(media.public_url, media.alt_text.nl ?? media.file_name);
              }}
            />
            <p className="text-muted-foreground mt-3 text-xs">
              {/* tab-2 copy intentionally minimal */}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
