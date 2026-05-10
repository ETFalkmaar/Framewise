/**
 * Stable error codes for the connector framework. Tests assert on
 * `.code` rather than the message so wording can evolve.
 */
export const CONNECTOR_ERROR_CODES = {
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  UNSUPPORTED_FLOW: 'UNSUPPORTED_FLOW',
  STATE_VALIDATION: 'STATE_VALIDATION',
  FLOW_ABORTED: 'FLOW_ABORTED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  MISSING_FIELD: 'MISSING_FIELD',
  TOKEN_EXCHANGE_FAILED: 'TOKEN_EXCHANGE_FAILED',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
} as const;

/**
 * Codes baked into the framework. Provider-specific connectors are
 * free to introduce their own (e.g. Moneybird's `RATE_LIMITED`) — see
 * the constructor's widened signature below.
 */
export type ConnectorErrorCode =
  | (typeof CONNECTOR_ERROR_CODES)[keyof typeof CONNECTOR_ERROR_CODES]
  | (string & {});

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  /** Optional structured details (e.g. failing field key). */
  readonly details?: Record<string, unknown>;

  constructor(code: ConnectorErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ConnectorError';
    this.code = code;
    this.details = details;
  }
}

/** Raised when `getConnector(id)` returns nothing. */
export class ProviderNotFoundError extends ConnectorError {
  constructor(providerId: string) {
    super(CONNECTOR_ERROR_CODES.PROVIDER_NOT_FOUND, `No connector registered for "${providerId}"`);
    this.name = 'ProviderNotFoundError';
  }
}

/**
 * Raised when an OAuth helper is called on an `api_key` connector, or
 * `submitApiKeyCredentials` is called on an `oauth` connector.
 */
export class UnsupportedFlowError extends ConnectorError {
  constructor(providerId: string, flow: 'oauth' | 'api_key') {
    super(
      CONNECTOR_ERROR_CODES.UNSUPPORTED_FLOW,
      `Connector "${providerId}" does not support the ${flow} flow`
    );
    this.name = 'UnsupportedFlowError';
  }
}

/**
 * Raised by `handleOAuthCallback` when the cookie state and the
 * `state` query parameter disagree (CSRF protection) or the cookie
 * is missing / expired.
 */
export class StateValidationError extends ConnectorError {
  constructor(message = 'OAuth state failed validation') {
    super(CONNECTOR_ERROR_CODES.STATE_VALIDATION, message);
    this.name = 'StateValidationError';
  }
}

/** Raised when the OAuth provider redirects back without a `code`. */
export class FlowAbortedError extends ConnectorError {
  constructor(reason = 'OAuth flow was cancelled by the user') {
    super(CONNECTOR_ERROR_CODES.FLOW_ABORTED, reason);
    this.name = 'FlowAbortedError';
  }
}

/** Raised when `testConnection` returns `{ ok: false, ... }`. */
export class InvalidCredentialsError extends ConnectorError {
  constructor(providerId: string, providerError?: string) {
    super(
      CONNECTOR_ERROR_CODES.INVALID_CREDENTIALS,
      providerError ?? `Provider "${providerId}" rejected the supplied credentials`,
      { providerId, providerError }
    );
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Raised by `submitApiKeyCredentials` when a `required` field is
 * missing or fails its `validation` rule.
 */
export class MissingFieldError extends ConnectorError {
  constructor(fieldKey: string, providerId: string) {
    super(
      CONNECTOR_ERROR_CODES.MISSING_FIELD,
      `Required field "${fieldKey}" is missing for connector "${providerId}"`,
      { fieldKey, providerId }
    );
    this.name = 'MissingFieldError';
  }
}
