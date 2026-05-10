/**
 * Token vault.
 *
 * Application code imports from `@/lib/vault`. Internals
 * (`crypto.ts`, `audit.ts`, `storage.ts`) can be reorganised — for
 * example to swap AES-256-GCM for Supabase Vault in step 119 — without
 * breaking call sites.
 *
 * Threat model (today):
 *  - At rest: tokens encrypted with AES-256-GCM under a 32-byte key
 *    (`TOKEN_ENCRYPTION_KEY` env var). Random 12-byte IV per call so
 *    identical inputs produce different ciphertext.
 *  - At access: every encrypt / decrypt / revoke / refresh call writes
 *    an immutable row to `token_access_log`.
 *  - At boundary: `getToken` checks the actor's tenant matches the
 *    connection's tenant; mismatches throw `AccessDeniedError`
 *    *before* any decrypt is attempted.
 */

export {
  EncryptionError,
  TokenNotFoundError,
  AccessDeniedError,
  VAULT_ERROR_CODES,
  type VaultErrorCode,
} from './errors';

export { encrypt, decrypt, isCiphertext, decryptIfWrapped, __setKeyOverride } from './crypto';

export { logAccess, listForTenant, listForConnection } from './audit';

export { storeToken, getToken, rotateToken, revokeToken, type VaultActor } from './storage';
