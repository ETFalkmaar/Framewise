import { del, put } from '@vercel/blob';

import { STORAGE_ERROR_CODES, StorageError } from '../errors';
import type { StorageProvider, UploadBody, UploadResult } from '../provider';

/** Body shape accepted by `@vercel/blob`'s `put()` (string / Buffer / Blob / streams). */
type VercelPutBody = Parameters<typeof put>[1];

/**
 * `@vercel/blob`'s `put()` accepts `Buffer`, not raw `Uint8Array` —
 * narrow our broader `UploadBody` to a shape it understands by
 * promoting plain `Uint8Array` to `Buffer` (zero-copy in Node).
 */
function toPutBody(body: UploadBody): VercelPutBody {
  if (body instanceof Uint8Array && !Buffer.isBuffer(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  return body as VercelPutBody;
}

/**
 * Vercel Blob adapter. Activated automatically when
 * `BLOB_READ_WRITE_TOKEN` is set; otherwise the storage layer falls
 * back to the mock provider so production keeps serving even when the
 * Blob store hasn't been provisioned yet.
 */
export const vercelBlobProvider: StorageProvider = {
  name: 'vercel-blob',
  get available() {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  },

  async upload({ path, body, mimeType, sizeBytes }): Promise<UploadResult> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new StorageError(
        STORAGE_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
        'BLOB_READ_WRITE_TOKEN is not set; cannot use the Vercel Blob provider'
      );
    }
    try {
      const blob = await put(path, toPutBody(body), {
        access: 'public',
        contentType: mimeType,
        // We control the path entirely — disable the random suffix so a
        // re-upload to the same `tenants/<id>/...` path overwrites
        // rather than accumulating siblings.
        addRandomSuffix: false,
      });
      return {
        path,
        url: blob.url,
        sizeBytes,
        mimeType,
      };
    } catch (err) {
      throw new StorageError(
        STORAGE_ERROR_CODES.UPLOAD_FAILED,
        `Vercel Blob upload failed: ${(err as Error).message}`
      );
    }
  },

  async delete(path) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new StorageError(
        STORAGE_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
        'BLOB_READ_WRITE_TOKEN is not set; cannot use the Vercel Blob provider'
      );
    }
    try {
      await del(path);
    } catch (err) {
      throw new StorageError(
        STORAGE_ERROR_CODES.DELETE_FAILED,
        `Vercel Blob delete failed: ${(err as Error).message}`
      );
    }
  },
};
