import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_ERROR_CODES,
  StorageError,
  __setStorageProviderOverride,
  deleteMedia,
  getActiveProvider,
  mockStorageProvider,
  uploadMedia,
  vercelBlobProvider,
  type StorageProvider,
} from '@/lib/storage';
import { mediaRepo, resetStore } from '@/lib/data';
import { ValidationError } from '@/lib/validation';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';

beforeEach(() => {
  resetStore();
  __setStorageProviderOverride(null);
});
afterEach(() => {
  __setStorageProviderOverride(null);
  resetStore();
});

describe('getActiveProvider', () => {
  it('returns mock when no BLOB token and no override', () => {
    const prev = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    try {
      expect(getActiveProvider().name).toBe('mock');
    } finally {
      if (prev) process.env.BLOB_READ_WRITE_TOKEN = prev;
    }
  });

  it('returns vercel-blob when BLOB token is set', () => {
    const prev = process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_READ_WRITE_TOKEN = 'fake-token';
    try {
      expect(getActiveProvider().name).toBe('vercel-blob');
    } finally {
      if (prev) process.env.BLOB_READ_WRITE_TOKEN = prev;
      else delete process.env.BLOB_READ_WRITE_TOKEN;
    }
  });

  it('honours the test override regardless of env', () => {
    __setStorageProviderOverride(mockStorageProvider);
    process.env.BLOB_READ_WRITE_TOKEN = 'fake-token';
    try {
      expect(getActiveProvider().name).toBe('mock');
    } finally {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    }
  });
});

describe('uploadMedia (mock provider)', () => {
  it('inserts a media row and returns the upload result', async () => {
    const before = (await mediaRepo.listByTenant(VILLA)).length;
    const result = await uploadMedia({
      tenantId: VILLA,
      uploadedByUserId: SUPER,
      fileName: 'fresh.png',
      mimeType: 'image/png',
      sizeBytes: 1234,
      body: Buffer.from('fake-png-bytes'),
      altText: { en: 'Fresh upload' },
      width: 800,
      height: 600,
      now: new Date(Date.UTC(2026, 5, 9)),
    });
    expect(result.provider).toBe('mock');
    expect(result.media.file_name).toBe('fresh.png');
    expect(result.media.storage_path).toBe(`tenants/${VILLA}/2026/06/fresh.png`);
    expect(result.media.public_url).toMatch(/picsum\.photos/);
    expect(result.media.alt_text.en).toBe('Fresh upload');

    const after = await mediaRepo.listByTenant(VILLA);
    expect(after.length).toBe(before + 1);
  });

  it('rejects unsupported MIME types upstream of the provider', async () => {
    let caught: unknown;
    try {
      await uploadMedia({
        tenantId: VILLA,
        uploadedByUserId: SUPER,
        fileName: 'evil.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 100,
        body: Buffer.from('x'),
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe(STORAGE_ERROR_CODES.INVALID_MIME_TYPE);
  });

  it('rejects bad tenant id from path builder', async () => {
    await expect(
      uploadMedia({
        tenantId: 'not-a-uuid',
        uploadedByUserId: SUPER,
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 100,
        body: Buffer.from('x'),
      })
    ).rejects.toBeInstanceOf(StorageError);
  });

  it('propagates provider errors', async () => {
    const failing: StorageProvider = {
      name: 'mock',
      available: true,
      async upload() {
        throw new StorageError(STORAGE_ERROR_CODES.UPLOAD_FAILED, 'simulated provider failure');
      },
      async delete() {},
    };
    __setStorageProviderOverride(failing);
    let caught: unknown;
    try {
      await uploadMedia({
        tenantId: VILLA,
        uploadedByUserId: SUPER,
        fileName: 'a.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 100,
        body: Buffer.from('x'),
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe(STORAGE_ERROR_CODES.UPLOAD_FAILED);
  });

  it('rejects when mediaInsertSchema would reject the row', async () => {
    // Empty alt_text record + missing locales is okay (we normalise),
    // but a non-image/document MIME slips past the storage layer when
    // we relax via a custom provider; check the validation chain by
    // bypassing the upload() and going straight to mediaRepo.create with
    // a bogus payload. We expect ValidationError.
    let caught: unknown;
    try {
      await mediaRepo.create({
        tenant_id: VILLA,
        file_name: '',
        mime_type: 'image/png',
        size_bytes: 1,
        storage_path: 'x',
        public_url: 'https://example.com/x.png',
        alt_text: { nl: '', fr: '', en: '' },
        width: null,
        height: null,
        uploaded_by_user_id: SUPER,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
  });
});

describe('deleteMedia', () => {
  it('removes the row and calls provider.delete', async () => {
    let provDeleted: string | null = null;
    const spyProvider: StorageProvider = {
      name: 'mock',
      available: true,
      async upload(input) {
        return {
          path: input.path,
          url: 'https://picsum.photos/seed/x/1/1',
          sizeBytes: input.sizeBytes,
          mimeType: input.mimeType,
        };
      },
      async delete(path) {
        provDeleted = path;
      },
    };
    __setStorageProviderOverride(spyProvider);

    const result = await uploadMedia({
      tenantId: VILLA,
      uploadedByUserId: SUPER,
      fileName: 'to_delete.png',
      mimeType: 'image/png',
      sizeBytes: 50,
      body: Buffer.from('xx'),
    });
    await deleteMedia(result.media.id);

    expect(provDeleted).toBe(result.media.storage_path);
    expect(await mediaRepo.findById(result.media.id)).toBeNull();
  });

  it('is a no-op for unknown ids', async () => {
    await expect(deleteMedia('00000000-0000-0000-0000-000000000000')).resolves.toBeUndefined();
  });
});

// Sanity check that the default exports are wired and can be imported.
describe('storage module exports', () => {
  it('re-exports both providers', () => {
    expect(mockStorageProvider.name).toBe('mock');
    expect(vercelBlobProvider.name).toBe('vercel-blob');
  });
});
