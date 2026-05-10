/**
 * Stable error codes for the token-vault subsystem. Codes outlive
 * messages: tests assert on `.code` rather than the human-readable
 * message so wording can be reworded without breaking call sites.
 */
export const VAULT_ERROR_CODES = {
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  KEY_MISSING: 'KEY_MISSING',
  KEY_INVALID: 'KEY_INVALID',
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  ACCESS_DENIED: 'ACCESS_DENIED',
} as const;

export type VaultErrorCode = (typeof VAULT_ERROR_CODES)[keyof typeof VAULT_ERROR_CODES];

abstract class VaultError extends Error {
  abstract readonly code: VaultErrorCode;
  constructor(message: string) {
    super(message);
    this.name = 'VaultError';
  }
}

/**
 * Thrown by `encrypt()` / `decrypt()` whenever the underlying GCM
 * operation fails — bad ciphertext, wrong key, tampered authTag,
 * malformed input, or non-strings. Carries the precise sub-code so
 * UI / callers can distinguish "set up your key" from "this token is
 * corrupt".
 */
export class EncryptionError extends VaultError {
  readonly code: VaultErrorCode;
  constructor(code: VaultErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'EncryptionError';
  }
}

/** Raised by storage helpers when the requested row has no token. */
export class TokenNotFoundError extends VaultError {
  readonly code = VAULT_ERROR_CODES.TOKEN_NOT_FOUND;
  constructor(connectionId: string) {
    super(`No encrypted token stored for connection ${connectionId}`);
    this.name = 'TokenNotFoundError';
  }
}

/**
 * Raised when a caller asks for a token belonging to a tenant they
 * don't own. The caller's `tenantId` is checked against the
 * connection row's `tenant_id` before any decryption is attempted.
 */
export class AccessDeniedError extends VaultError {
  readonly code = VAULT_ERROR_CODES.ACCESS_DENIED;
  constructor(connectionId: string, tenantId: string) {
    super(`Tenant ${tenantId} is not allowed to access connection ${connectionId}`);
    this.name = 'AccessDeniedError';
  }
}
