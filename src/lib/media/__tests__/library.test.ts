import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { mediaRepo, resetStore } from '@/lib/data';

import { softDeleteMediaFor, uploadMediaFor } from '../library';

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';
const RESTAURANT_OWNER_ID = 'a0000000-0000-0000-0000-000000000003';
const STRANGER_ID = 'a0000000-0000-0000-0000-000000000099';
const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';

const NOW = new Date('2026-05-11T12:00:00Z');
const TEST_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('uploadMediaFor', () => {
  it('uploads a valid PNG for the villa owner (Enterprise plan)', async () => {
    const result = await uploadMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      fileName: 'pool.png',
      mimeType: 'image/png',
      sizeBytes: TEST_BYTES.byteLength,
      body: TEST_BYTES,
      altText: { nl: 'Zwembad' },
      now: NOW,
    });
    expect(result.success).toBe(true);
    expect(result.media?.tenant_id).toBe(VILLA_ID);
    expect(result.media?.deleted_at).toBeNull();
  });

  it('lets the super-admin upload for any tenant', async () => {
    const result = await uploadMediaFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      fileName: 'admin.png',
      mimeType: 'image/png',
      sizeBytes: TEST_BYTES.byteLength,
      body: TEST_BYTES,
      now: NOW,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a stranger with no role on the tenant', async () => {
    const result = await uploadMediaFor({
      userId: STRANGER_ID,
      tenantId: VILLA_ID,
      fileName: 'x.png',
      mimeType: 'image/png',
      sizeBytes: TEST_BYTES.byteLength,
      body: TEST_BYTES,
      now: NOW,
    });
    expect(result.errorCode).toBe('forbidden');
  });

  it('rejects an unknown tenant', async () => {
    const result = await uploadMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: '00000000-0000-0000-0000-000000000000',
      fileName: 'x.png',
      mimeType: 'image/png',
      sizeBytes: TEST_BYTES.byteLength,
      body: TEST_BYTES,
      now: NOW,
    });
    expect(result.errorCode).toBe('tenant_not_found');
  });

  it('rejects an invalid mime type', async () => {
    const result = await uploadMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      fileName: 'evil.exe',
      mimeType: 'application/x-msdownload',
      sizeBytes: 16,
      body: TEST_BYTES,
      now: NOW,
    });
    expect(result.errorCode).toBe('invalid_type');
  });

  it('rejects a file that exceeds the storage size limit', async () => {
    const result = await uploadMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      fileName: 'huge.png',
      mimeType: 'image/png',
      sizeBytes: 60 * 1024 * 1024, // 60 MB — over the 50 MB cap
      body: TEST_BYTES,
      now: NOW,
    });
    expect(result.errorCode).toBe('file_too_large');
  });

  it('rejects an empty file (storage layer reports it as file_too_large)', async () => {
    const result = await uploadMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      fileName: 'empty.png',
      mimeType: 'image/png',
      sizeBytes: 0,
      body: new Uint8Array(0),
      now: NOW,
    });
    // Storage uses a single FILE_TOO_LARGE code for both edges of
    // the size range; we don't synthesise a separate EMPTY_FILE.
    expect(result.success).toBe(false);
    expect(['empty_file', 'file_too_large']).toContain(result.errorCode);
  });

  it('the restaurant Pro-plan owner can upload', async () => {
    const result = await uploadMediaFor({
      userId: RESTAURANT_OWNER_ID,
      tenantId: RESTAURANT_ID,
      fileName: 'menu.png',
      mimeType: 'image/png',
      sizeBytes: TEST_BYTES.byteLength,
      body: TEST_BYTES,
      now: NOW,
    });
    expect(result.success).toBe(true);
  });
});

describe('softDeleteMediaFor', () => {
  async function uploadOne() {
    const out = await uploadMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      fileName: 'to-delete.png',
      mimeType: 'image/png',
      sizeBytes: TEST_BYTES.byteLength,
      body: TEST_BYTES,
      now: NOW,
    });
    if (!out.media) throw new Error('upload failed in helper');
    return out.media;
  }

  it('soft-deletes a media item (deleted_at gets a timestamp)', async () => {
    const media = await uploadOne();
    const result = await softDeleteMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      mediaId: media.id,
    });
    expect(result.success).toBe(true);

    const after = await mediaRepo.findById(media.id);
    expect(after?.deleted_at).not.toBeNull();
  });

  it('listByTenant filters soft-deleted rows by default', async () => {
    const media = await uploadOne();
    await softDeleteMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      mediaId: media.id,
    });
    const visible = await mediaRepo.listByTenant(VILLA_ID);
    expect(visible.some((m) => m.id === media.id)).toBe(false);
  });

  it('listByTenant returns soft-deleted rows when includeDeleted=true', async () => {
    const media = await uploadOne();
    await softDeleteMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      mediaId: media.id,
    });
    const withDeleted = await mediaRepo.listByTenant(VILLA_ID, { includeDeleted: true });
    expect(withDeleted.some((m) => m.id === media.id)).toBe(true);
  });

  it('rejects a stranger', async () => {
    const media = await uploadOne();
    const result = await softDeleteMediaFor({
      userId: STRANGER_ID,
      tenantId: VILLA_ID,
      mediaId: media.id,
    });
    expect(result.errorCode).toBe('forbidden');
  });

  it('rejects when media belongs to a different tenant', async () => {
    const media = await uploadOne();
    const result = await softDeleteMediaFor({
      userId: RESTAURANT_OWNER_ID,
      tenantId: RESTAURANT_ID,
      mediaId: media.id,
    });
    // The restaurant owner does pass canEditBlocks for the restaurant
    // tenant — but the media row's tenant_id mismatches.
    expect(result.errorCode).toBe('tenant_mismatch');
  });

  it('returns media_not_found for an unknown id', async () => {
    const result = await softDeleteMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      mediaId: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.errorCode).toBe('media_not_found');
  });

  it('is idempotent: deleting an already-deleted item still returns success', async () => {
    const media = await uploadOne();
    await softDeleteMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      mediaId: media.id,
    });
    const second = await softDeleteMediaFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      mediaId: media.id,
    });
    expect(second.success).toBe(true);
  });

  it('the super-admin can soft-delete any item', async () => {
    const media = await uploadOne();
    const result = await softDeleteMediaFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      mediaId: media.id,
    });
    expect(result.success).toBe(true);
  });
});
