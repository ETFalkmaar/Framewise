/**
 * Stable error codes for the storage subsystem.
 * Tests assert on `.code`; messages can be reworded freely.
 */
export const STORAGE_ERROR_CODES = {
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  INVALID_PATH: 'INVALID_PATH',
  INVALID_MIME_TYPE: 'INVALID_MIME_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
} as const;

export type StorageErrorCode = (typeof STORAGE_ERROR_CODES)[keyof typeof STORAGE_ERROR_CODES];

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'StorageError';
  }
}
