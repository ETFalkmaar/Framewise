import { mediaRepo } from '@/lib/data';
import type { LocaleCode, Media } from '@/types/database';

import { mockStorageProvider } from './providers/mock';
import { vercelBlobProvider } from './providers/vercel-blob';
import type { StorageProvider, UploadBody, UploadResult } from './provider';
import { assertValidUpload, buildTenantPath } from './validation';

let providerOverride: StorageProvider | null = null;

/** Test seam — swap the active provider without touching `process.env`. */
export function __setStorageProviderOverride(provider: StorageProvider | null): void {
  providerOverride = provider;
}

/**
 * Pick the right provider for the current environment.
 *
 * Decision order:
 *  1. Test-only override (set via `__setStorageProviderOverride`).
 *  2. Vercel Blob, if `BLOB_READ_WRITE_TOKEN` is set.
 *  3. Mock provider — always works, falls back gracefully.
 *
 * Production happily falls through to mock if the Blob store isn't
 * provisioned yet, so deploy never hard-fails on missing storage env.
 */
export function getActiveProvider(): StorageProvider {
  if (providerOverride) return providerOverride;
  if (vercelBlobProvider.available) return vercelBlobProvider;
  return mockStorageProvider;
}

export interface UploadMediaInput {
  tenantId: string;
  uploadedByUserId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  body: UploadBody;
  altText?: Partial<Record<LocaleCode, string>>;
  width?: number | null;
  height?: number | null;
  /** Injectable for tests so paths don't drift with the calendar. */
  now?: Date;
}

/**
 * Validate → compute tenant path → upload via the active provider →
 * persist via `mediaRepo.create`. Returns the freshly-inserted `Media`
 * row so the UI can immediately render it.
 */
export async function uploadMedia(input: UploadMediaInput): Promise<{
  media: Media;
  upload: UploadResult;
  provider: StorageProvider['name'];
}> {
  assertValidUpload({
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  const path = buildTenantPath(input.tenantId, input.fileName, input.now);
  const provider = getActiveProvider();
  const upload = await provider.upload({
    path,
    body: input.body,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  const media = await mediaRepo.create({
    tenant_id: input.tenantId,
    file_name: input.fileName,
    mime_type: upload.mimeType,
    size_bytes: upload.sizeBytes,
    storage_path: upload.path,
    public_url: upload.url,
    alt_text: {
      nl: input.altText?.nl ?? '',
      fr: input.altText?.fr ?? '',
      en: input.altText?.en ?? '',
    },
    width: input.width ?? null,
    height: input.height ?? null,
    uploaded_by_user_id: input.uploadedByUserId,
  });

  return { media, upload, provider: provider.name };
}

/** Best-effort delete — removes both the storage object and the row. */
export async function deleteMedia(mediaId: string): Promise<void> {
  const row = await mediaRepo.findById(mediaId);
  if (!row) return;
  const provider = getActiveProvider();
  await provider.delete(row.storage_path);
  await mediaRepo.delete(mediaId);
}
