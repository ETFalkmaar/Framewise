import { createHash } from 'node:crypto';

import type { StorageProvider, UploadBody, UploadResult } from '../provider';

/**
 * In-process mock provider. Doesn't actually persist bytes — it just
 * computes a deterministic Picsum URL from the path so the media
 * library renders thumbnails identical across reloads.
 *
 * Used everywhere in development and as a production fallback when
 * `BLOB_READ_WRITE_TOKEN` is unset.
 */
function picsumUrl(path: string, mimeType: string): string {
  if (!mimeType.startsWith('image/')) {
    // Non-image: return a generic placeholder file URL.
    return `https://placehold.co/600x400?text=${encodeURIComponent(path.split('/').pop() ?? 'file')}`;
  }
  // Stable seed per path so the same media row always shows the same image.
  const seed = createHash('sha256').update(path).digest('hex').slice(0, 12);
  return `https://picsum.photos/seed/${seed}/800/600`;
}

function bodySize(body: UploadBody): number {
  if (typeof body === 'string') return Buffer.byteLength(body, 'utf8');
  if (body instanceof Uint8Array || Buffer.isBuffer(body)) return body.byteLength;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size;
  return 0;
}

export const mockStorageProvider: StorageProvider = {
  name: 'mock',
  available: true,

  async upload({ path, body, mimeType, sizeBytes }): Promise<UploadResult> {
    // sizeBytes is authoritative (validated upstream); fall back to the
    // body-derived value when the caller passes 0.
    const finalSize = sizeBytes > 0 ? sizeBytes : bodySize(body);
    return {
      path,
      url: picsumUrl(path, mimeType),
      sizeBytes: finalSize,
      mimeType,
    };
  },

  async delete() {
    // No-op — there's nothing to delete on the in-memory mock.
  },
};
