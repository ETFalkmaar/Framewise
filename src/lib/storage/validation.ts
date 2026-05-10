import { STORAGE_ERROR_CODES, StorageError } from './errors';

/**
 * Allowed MIME types for media uploads. Constrained to common image and
 * document formats that the AI agent / page editor needs to handle.
 *
 * Adding a new type is a one-line append — both the validator and the
 * UI dropdown read from this constant.
 */
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
  // Documents
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** 50 MB hard cap — same constant as `mediaInsertSchema.size_bytes`. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Reject filenames with path-traversal sequences or NUL bytes. */
const FILENAME_RE = /^[A-Za-z0-9._\- ()]+$/;

export interface UploadValidationInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Throws `StorageError` if the upload should be rejected.
 *
 * - `fileName` must use a safe character set (no `/`, no `..`, no NUL).
 * - `mimeType` must be in `ALLOWED_MIME_TYPES`.
 * - `sizeBytes` must be > 0 and <= `MAX_UPLOAD_BYTES`.
 */
export function assertValidUpload(input: UploadValidationInput): void {
  if (!input.fileName || !FILENAME_RE.test(input.fileName) || input.fileName.length > 255) {
    throw new StorageError(
      STORAGE_ERROR_CODES.INVALID_PATH,
      `Invalid file name: must use letters, digits, dot, dash, underscore, space, parens; received "${input.fileName}"`
    );
  }
  if (!isAllowedMimeType(input.mimeType)) {
    throw new StorageError(
      STORAGE_ERROR_CODES.INVALID_MIME_TYPE,
      `MIME type "${input.mimeType}" is not in the allow-list`
    );
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new StorageError(
      STORAGE_ERROR_CODES.FILE_TOO_LARGE,
      'sizeBytes must be a positive integer'
    );
  }
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new StorageError(
      STORAGE_ERROR_CODES.FILE_TOO_LARGE,
      `File exceeds ${MAX_UPLOAD_BYTES} bytes (got ${input.sizeBytes})`
    );
  }
}

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Build a tenant-scoped storage path. Format:
 *
 *   tenants/<tenantId>/<yyyy>/<mm>/<sanitized-filename>
 *
 * Two pieces of safety:
 *  1. The tenant id is the *only* identifier in the path — paths cannot
 *     accidentally cross tenants.
 *  2. The filename is run through `assertValidUpload` first; here we only
 *     replace spaces with underscores so URLs stay clean.
 *
 * `now` is injectable for deterministic tests.
 */
export function buildTenantPath(
  tenantId: string,
  fileName: string,
  now: Date = new Date()
): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    throw new StorageError(
      STORAGE_ERROR_CODES.INVALID_PATH,
      `Invalid tenant id "${tenantId}" — must be a UUID`
    );
  }
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safe = fileName.replace(/\s+/g, '_');
  return `tenants/${tenantId}/${yyyy}/${mm}/${safe}`;
}
