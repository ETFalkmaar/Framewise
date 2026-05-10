import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { EncryptionError, VAULT_ERROR_CODES } from './errors';

/**
 * Wire format for ciphertext stored in `provider_connections.encrypted_token`:
 *
 *   v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>
 *
 * - `v1`        — version prefix; lets us migrate the algorithm later
 *                 (e.g. v2 with key-wrapping) without breaking old rows.
 * - `iv-hex`    — 12 random bytes per encryption (recommended for GCM).
 * - `authTag`   — 16 bytes from GCM, validates the ciphertext is intact.
 * - `cipher`    — variable length, the actual AES-256-GCM output.
 *
 * Splitting on `:` is safe because each field is hex.
 */
const VERSION_PREFIX = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32; // AES-256
const AUTH_TAG_BYTES = 16;

// `*` rather than `+` so the ciphertext field is allowed to be empty
// (encrypting `''` produces zero bytes of ciphertext). The iv and tag
// fields are additionally length-checked below — they cannot be empty.
const HEX_RE = /^[0-9a-fA-F]*$/;

/**
 * `true` when the env var-supplied key is a valid 32-byte hex string.
 * Tests stub via `setKeyOverride`; production reads from `process.env`.
 */
let keyOverride: Buffer | null = null;

/** Test seam — swap the active key without touching `process.env`. */
export function __setKeyOverride(key: Buffer | null): void {
  keyOverride = key;
}

function loadKey(): Buffer {
  if (keyOverride) return keyOverride;

  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.length === 0) {
    throw new EncryptionError(
      VAULT_ERROR_CODES.KEY_MISSING,
      'TOKEN_ENCRYPTION_KEY is not set. ' +
        "Generate one with `node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"` " +
        'and add it to .env.local (development) or the Vercel project settings (production).'
    );
  }
  if (raw.length !== KEY_BYTES * 2 || !HEX_RE.test(raw)) {
    throw new EncryptionError(
      VAULT_ERROR_CODES.KEY_INVALID,
      `TOKEN_ENCRYPTION_KEY must be exactly ${KEY_BYTES * 2} hex characters (got ${raw.length})`
    );
  }
  return Buffer.from(raw, 'hex');
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 *
 * Random IV per call → identical inputs produce different ciphertext.
 * Returns the wire-format string described above.
 */
export function encrypt(plaintext: string): string {
  if (typeof plaintext !== 'string') {
    throw new EncryptionError(
      VAULT_ERROR_CODES.ENCRYPTION_FAILED,
      'encrypt(): plaintext must be a string'
    );
  }

  const key = loadKey();
  const iv = randomBytes(IV_BYTES);

  try {
    const cipher = createCipheriv(ALGO, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
      VERSION_PREFIX,
      iv.toString('hex'),
      authTag.toString('hex'),
      ciphertext.toString('hex'),
    ].join(':');
  } catch (err) {
    throw new EncryptionError(
      VAULT_ERROR_CODES.ENCRYPTION_FAILED,
      `Encryption failed: ${(err as Error).message}`
    );
  }
}

/**
 * Decrypt a ciphertext string written by `encrypt()`.
 *
 * Throws `EncryptionError` with `DECRYPTION_FAILED` on:
 *  - bad format (missing prefix / wrong field count / non-hex fields)
 *  - wrong key (auth-tag verification fails)
 *  - tampered ciphertext (auth-tag verification fails)
 */
export function decrypt(ciphertext: string): string {
  if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
    throw new EncryptionError(
      VAULT_ERROR_CODES.DECRYPTION_FAILED,
      'decrypt(): ciphertext must be a non-empty string'
    );
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new EncryptionError(
      VAULT_ERROR_CODES.DECRYPTION_FAILED,
      `Malformed ciphertext: expected "${VERSION_PREFIX}:<iv>:<tag>:<ct>"`
    );
  }
  const [, ivHex, tagHex, ctHex] = parts as [string, string, string, string];
  if (!HEX_RE.test(ivHex) || !HEX_RE.test(tagHex) || !HEX_RE.test(ctHex)) {
    throw new EncryptionError(VAULT_ERROR_CODES.DECRYPTION_FAILED, 'Ciphertext fields must be hex');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ct = Buffer.from(ctHex, 'hex');
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new EncryptionError(
      VAULT_ERROR_CODES.DECRYPTION_FAILED,
      `Ciphertext field length mismatch (iv=${iv.length}, tag=${authTag.length})`
    );
  }

  const key = loadKey();
  try {
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch (err) {
    // Most common cause: wrong key or tampered authTag. Don't leak which.
    throw new EncryptionError(
      VAULT_ERROR_CODES.DECRYPTION_FAILED,
      `Decryption failed: ${(err as Error).message}`
    );
  }
}

/** Heuristic to recognise wire-format strings produced by `encrypt()`. */
export function isCiphertext(value: string | null): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION_PREFIX}:`);
}

/**
 * Decrypt only when the value looks like our wire format. Otherwise
 * the value is returned unchanged. Used by the storage layer in
 * **development** so existing seed rows that contain plain
 * `mock_token_*` strings keep working — production refuses (see
 * `getToken()` in `storage.ts`).
 */
export function decryptIfWrapped(value: string): { plaintext: string; wasEncrypted: boolean } {
  if (isCiphertext(value)) {
    return { plaintext: decrypt(value), wasEncrypted: true };
  }
  return { plaintext: value, wasEncrypted: false };
}
