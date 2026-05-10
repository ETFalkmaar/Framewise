/**
 * Storage layer.
 *
 * Application code imports from `@/lib/storage`. The active backend
 * is decided by `getActiveProvider()`:
 *   - Vercel Blob in production (when `BLOB_READ_WRITE_TOKEN` is set)
 *   - In-process mock everywhere else (and as a graceful production
 *     fallback when the Blob store hasn't been provisioned yet)
 *
 * Step 119 will add a Supabase Storage adapter behind the same
 * `StorageProvider` interface — call sites stay unchanged.
 */

export { STORAGE_ERROR_CODES, StorageError, type StorageErrorCode } from './errors';

export {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  assertValidUpload,
  buildTenantPath,
  isAllowedMimeType,
  type AllowedMimeType,
  type UploadValidationInput,
} from './validation';

export type { StorageProvider, UploadBody, UploadResult } from './provider';

export { mockStorageProvider } from './providers/mock';
export { vercelBlobProvider } from './providers/vercel-blob';

export {
  __setStorageProviderOverride,
  deleteMedia,
  getActiveProvider,
  uploadMedia,
  type UploadMediaInput,
} from './manager';
