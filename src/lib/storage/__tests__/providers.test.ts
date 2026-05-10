import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_ERROR_CODES,
  StorageError,
  mockStorageProvider,
  vercelBlobProvider,
} from '@/lib/storage';

const PATH = 'tenants/11111111-1111-1111-1111-111111111111/2026/05/test.jpg';

describe('mock storage provider', () => {
  it('is always available', () => {
    expect(mockStorageProvider.available).toBe(true);
    expect(mockStorageProvider.name).toBe('mock');
  });

  it('returns a Picsum URL for images, deterministic per path', async () => {
    const a = await mockStorageProvider.upload({
      path: PATH,
      body: Buffer.from('x'),
      mimeType: 'image/jpeg',
      sizeBytes: 1,
    });
    const b = await mockStorageProvider.upload({
      path: PATH,
      body: Buffer.from('different body'),
      mimeType: 'image/jpeg',
      sizeBytes: 1,
    });
    expect(a.url).toBe(b.url);
    expect(a.url).toMatch(/^https:\/\/picsum\.photos\/seed\/[0-9a-f]+\/800\/600$/);
  });

  it('returns a placeholder URL for non-image MIME types', async () => {
    const r = await mockStorageProvider.upload({
      path: 'tenants/11111111-1111-1111-1111-111111111111/2026/05/menu.pdf',
      body: Buffer.from('pdf-bytes'),
      mimeType: 'application/pdf',
      sizeBytes: 9,
    });
    expect(r.url).toContain('placehold.co');
  });

  it('echoes path / mimeType / sizeBytes', async () => {
    const r = await mockStorageProvider.upload({
      path: PATH,
      body: Buffer.from('ten bytes!'),
      mimeType: 'image/png',
      sizeBytes: 10,
    });
    expect(r.path).toBe(PATH);
    expect(r.mimeType).toBe('image/png');
    expect(r.sizeBytes).toBe(10);
  });

  it('falls back to body length when sizeBytes is 0', async () => {
    const r = await mockStorageProvider.upload({
      path: PATH,
      body: Buffer.from('exactly-eleven'),
      mimeType: 'image/png',
      sizeBytes: 0,
    });
    expect(r.sizeBytes).toBe(14);
  });

  it('delete is a safe no-op', async () => {
    await expect(mockStorageProvider.delete(PATH)).resolves.toBeUndefined();
  });
});

describe('vercel-blob provider', () => {
  const prev = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });
  afterEach(() => {
    if (prev) process.env.BLOB_READ_WRITE_TOKEN = prev;
    else delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it('is unavailable without BLOB_READ_WRITE_TOKEN', () => {
    expect(vercelBlobProvider.available).toBe(false);
  });

  it('upload throws PROVIDER_NOT_CONFIGURED without token', async () => {
    let caught: unknown;
    try {
      await vercelBlobProvider.upload({
        path: PATH,
        body: Buffer.from('x'),
        mimeType: 'image/png',
        sizeBytes: 1,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe(STORAGE_ERROR_CODES.PROVIDER_NOT_CONFIGURED);
  });

  it('delete throws PROVIDER_NOT_CONFIGURED without token', async () => {
    let caught: unknown;
    try {
      await vercelBlobProvider.delete(PATH);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe(STORAGE_ERROR_CODES.PROVIDER_NOT_CONFIGURED);
  });

  it('becomes available when BLOB_READ_WRITE_TOKEN is set', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'fake-token-for-test';
    expect(vercelBlobProvider.available).toBe(true);
  });
});
