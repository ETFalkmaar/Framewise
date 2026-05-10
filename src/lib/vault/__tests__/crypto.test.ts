import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  __setKeyOverride,
  decrypt,
  encrypt,
  EncryptionError,
  isCiphertext,
  VAULT_ERROR_CODES,
} from '@/lib/vault';

const KEY_A = randomBytes(32);
const KEY_B = randomBytes(32);

beforeEach(() => {
  __setKeyOverride(KEY_A);
});

afterEach(() => {
  __setKeyOverride(null);
});

describe('vault crypto', () => {
  it.each([
    ['short', 'a'],
    ['typical', 'sk-test-1234567890abcdef'],
    ['long', 'x'.repeat(2048)],
    ['unicode', '🇨🇼 villa-bonbini ✓'],
    ['empty', ''],
  ])('round-trips %s plaintext', (_label, plaintext) => {
    const cipher = encrypt(plaintext);
    expect(isCiphertext(cipher)).toBe(true);
    expect(decrypt(cipher)).toBe(plaintext);
  });

  it('produces non-deterministic output (random IV per call)', () => {
    const a = encrypt('same input');
    const b = encrypt('same input');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same input');
    expect(decrypt(b)).toBe('same input');
  });

  it('rejects ciphertext encrypted under a different key', () => {
    const cipher = encrypt('secret');
    __setKeyOverride(KEY_B);
    let caught: unknown;
    try {
      decrypt(cipher);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EncryptionError);
    expect((caught as EncryptionError).code).toBe(VAULT_ERROR_CODES.DECRYPTION_FAILED);
  });

  it('rejects ciphertext with a tampered authTag', () => {
    const cipher = encrypt('secret');
    // The format is v1:iv:tag:ct — flip a hex char in tag.
    const parts = cipher.split(':');
    const tag = parts[2]!;
    const flipped = tag[0] === 'a' ? `b${tag.slice(1)}` : `a${tag.slice(1)}`;
    const tampered = [parts[0], parts[1], flipped, parts[3]].join(':');

    let caught: unknown;
    try {
      decrypt(tampered);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EncryptionError);
    expect((caught as EncryptionError).code).toBe(VAULT_ERROR_CODES.DECRYPTION_FAILED);
  });

  it('rejects ciphertext with a tampered ciphertext byte', () => {
    const cipher = encrypt('hello world');
    const parts = cipher.split(':');
    const ct = parts[3]!;
    // Flip a hex char inside the ciphertext.
    const flipped = (ct[0] === '0' ? '1' : '0') + ct.slice(1);
    const tampered = [parts[0], parts[1], parts[2], flipped].join(':');

    let caught: unknown;
    try {
      decrypt(tampered);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EncryptionError);
    expect((caught as EncryptionError).code).toBe(VAULT_ERROR_CODES.DECRYPTION_FAILED);
  });

  it('rejects malformed ciphertext (wrong prefix)', () => {
    expect(() => decrypt('v0:abc:def:ghi')).toThrow(EncryptionError);
  });

  it('rejects malformed ciphertext (non-hex fields)', () => {
    expect(() => decrypt('v1:not-hex:also-not:hex-fail')).toThrow(EncryptionError);
  });

  it('rejects empty / non-string inputs', () => {
    expect(() => decrypt('')).toThrow(EncryptionError);
    // @ts-expect-error - intentional bad input
    expect(() => encrypt(undefined)).toThrow(EncryptionError);
  });

  it('throws KEY_MISSING when no key override and no env var', () => {
    __setKeyOverride(null);
    const prev = process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    try {
      let caught: unknown;
      try {
        encrypt('x');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(EncryptionError);
      expect((caught as EncryptionError).code).toBe(VAULT_ERROR_CODES.KEY_MISSING);
    } finally {
      if (prev) process.env.TOKEN_ENCRYPTION_KEY = prev;
    }
  });

  it('throws KEY_INVALID for a wrong-length env key', () => {
    __setKeyOverride(null);
    const prev = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = 'too-short';
    try {
      let caught: unknown;
      try {
        encrypt('x');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(EncryptionError);
      expect((caught as EncryptionError).code).toBe(VAULT_ERROR_CODES.KEY_INVALID);
    } finally {
      if (prev) process.env.TOKEN_ENCRYPTION_KEY = prev;
      else delete process.env.TOKEN_ENCRYPTION_KEY;
    }
  });
});
