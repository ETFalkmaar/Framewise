import { describe, expect, it } from 'vitest';
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  STORAGE_ERROR_CODES,
  StorageError,
  assertValidUpload,
  buildTenantPath,
  isAllowedMimeType,
} from '@/lib/storage';

const VILLA = '11111111-1111-1111-1111-111111111111';

describe('storage validation', () => {
  it.each([
    ['simple', 'photo.jpg', 'image/jpeg', 100_000],
    ['parens', 'photo (1).png', 'image/png', 50_000],
    ['underscore + dot', 'menu_v1.pdf', 'application/pdf', 1_000_000],
    ['avif image', 'splash.avif', 'image/avif', 250_000],
  ])('accepts %s upload', (_label, fileName, mimeType, sizeBytes) => {
    expect(() => assertValidUpload({ fileName, mimeType, sizeBytes })).not.toThrow();
  });

  it('rejects path-traversal in fileName', () => {
    let caught: unknown;
    try {
      assertValidUpload({
        fileName: '../etc/passwd',
        mimeType: 'image/png',
        sizeBytes: 100,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe(STORAGE_ERROR_CODES.INVALID_PATH);
  });

  it('rejects forward slash in fileName', () => {
    expect(() =>
      assertValidUpload({ fileName: 'sub/dir/file.png', mimeType: 'image/png', sizeBytes: 100 })
    ).toThrow(StorageError);
  });

  it('rejects empty fileName', () => {
    expect(() =>
      assertValidUpload({ fileName: '', mimeType: 'image/png', sizeBytes: 100 })
    ).toThrow(StorageError);
  });

  it('rejects unsupported MIME types', () => {
    let caught: unknown;
    try {
      assertValidUpload({
        fileName: 'evil.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 100,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe(STORAGE_ERROR_CODES.INVALID_MIME_TYPE);
  });

  it('rejects file size beyond cap', () => {
    let caught: unknown;
    try {
      assertValidUpload({
        fileName: 'huge.png',
        mimeType: 'image/png',
        sizeBytes: MAX_UPLOAD_BYTES + 1,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe(STORAGE_ERROR_CODES.FILE_TOO_LARGE);
  });

  it('rejects zero or negative size', () => {
    expect(() =>
      assertValidUpload({ fileName: 'x.png', mimeType: 'image/png', sizeBytes: 0 })
    ).toThrow(StorageError);
    expect(() =>
      assertValidUpload({ fileName: 'x.png', mimeType: 'image/png', sizeBytes: -5 })
    ).toThrow(StorageError);
  });

  it('isAllowedMimeType narrows correctly', () => {
    for (const t of ALLOWED_MIME_TYPES) expect(isAllowedMimeType(t)).toBe(true);
    expect(isAllowedMimeType('application/javascript')).toBe(false);
  });
});

describe('buildTenantPath', () => {
  it('produces tenants/<id>/<yyyy>/<mm>/<file> shape', () => {
    const path = buildTenantPath(VILLA, 'photo.jpg', new Date(Date.UTC(2026, 4, 9)));
    expect(path).toBe(`tenants/${VILLA}/2026/05/photo.jpg`);
  });

  it('zero-pads single-digit months', () => {
    const path = buildTenantPath(VILLA, 'a.png', new Date(Date.UTC(2026, 0, 1)));
    expect(path).toContain('/2026/01/');
  });

  it('replaces spaces with underscores', () => {
    const path = buildTenantPath(VILLA, 'my photo.jpg', new Date(Date.UTC(2026, 5, 1)));
    expect(path.endsWith('/my_photo.jpg')).toBe(true);
  });

  it('rejects a non-UUID tenant id', () => {
    let caught: unknown;
    try {
      buildTenantPath('not-a-uuid', 'photo.jpg');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe(STORAGE_ERROR_CODES.INVALID_PATH);
  });

  it('produces deterministic output for the same inputs', () => {
    const a = buildTenantPath(VILLA, 'photo.jpg', new Date(Date.UTC(2026, 5, 9)));
    const b = buildTenantPath(VILLA, 'photo.jpg', new Date(Date.UTC(2026, 5, 9)));
    expect(a).toBe(b);
  });
});
