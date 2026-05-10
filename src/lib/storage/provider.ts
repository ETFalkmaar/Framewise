/**
 * Storage provider abstraction. All adapters return the same
 * `UploadResult` shape so call sites don't know whether they're
 * talking to Vercel Blob, Supabase Storage, or the in-process mock.
 */
export interface UploadResult {
  /** Tenant-scoped path inside the bucket — the storage_path column. */
  path: string;
  /** Publicly servable URL (CDN URL on prod, placeholder image in mock). */
  url: string;
  /** Size as confirmed by the storage layer (mirrors input). */
  sizeBytes: number;
  /** Provider-reported content type (mirrors input). */
  mimeType: string;
}

/**
 * Body shape accepted by `upload()` — matches what `formData.get(...)`
 * returns plus the Node `Buffer` we use server-side.
 */
export type UploadBody = string | Buffer | ArrayBuffer | Uint8Array | Blob;

export interface StorageProvider {
  /** Adapter id, exposed via `getActiveProvider()` for the UI. */
  readonly name: 'mock' | 'vercel-blob';
  /** True when this provider can perform real I/O (i.e. has its env). */
  readonly available: boolean;
  upload(input: {
    path: string;
    body: UploadBody;
    mimeType: string;
    sizeBytes: number;
  }): Promise<UploadResult>;
  delete(path: string): Promise<void>;
}
