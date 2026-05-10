// Same circular-dep avoidance as previous providers: import from
// internal files, not the `@/lib/connectors` barrel.
import { ConnectorError, InvalidCredentialsError } from '../../errors';

/**
 * PayPal-specific error codes added on top of the framework's standard
 * `CONNECTOR_ERROR_CODES`. Same convention as previous providers — we
 * only widen the set when the call site needs to distinguish a
 * failure mode (UI copy, retry policy, etc.).
 */
export const PAYPAL_ERROR_CODES = {
  /** Bad request body / invalid OAuth grant (400). */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Token lacks the required scope or app permissions (403). */
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  /** Resource (user, merchant, transaction) not found (404). */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  /** PayPal rate-limited us (429). PayPal includes its own retry hints. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** PayPal-side transient error (5xx). */
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  /** Network-level failure (DNS, timeout, refused). */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET env vars missing. */
  CONFIGURATION_INCOMPLETE: 'CONFIGURATION_INCOMPLETE',
  /** Anything outside the explicit switch — message includes the body. */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * PayPal returns errors in two distinct envelope shapes:
 *
 *  - OAuth (`/v1/oauth2/*`):
 *      { "error": "invalid_grant", "error_description": "..." }
 *  - REST API (`/v1/identity/*`, `/v2/*`):
 *      { "name": "INVALID_REQUEST", "message": "...", "details": [...] }
 *
 * We probe both, fall back to the HTTP status text last.
 */
function extractMessage(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;

    // OAuth envelope.
    if (typeof obj.error_description === 'string' && obj.error_description.length > 0) {
      const err =
        typeof obj.error === 'string'
          ? `${obj.error}: ${obj.error_description}`
          : obj.error_description;
      return err;
    }
    if (typeof obj.error === 'string' && obj.error.length > 0) return obj.error;

    // REST envelope.
    if (typeof obj.message === 'string' && obj.message.length > 0) {
      const name = typeof obj.name === 'string' ? `${obj.name}: ${obj.message}` : obj.message;
      return name;
    }
    if (typeof obj.name === 'string' && obj.name.length > 0) return obj.name;
  }

  if (typeof body === 'string' && body.length > 0 && body.length < 500) return body;
  return `${status} ${statusText}`.trim();
}

/**
 * Translate a PayPal HTTP response to a typed framework error.
 * Always returns (never throws) — the caller decides whether to
 * `throw` or fold into a `TestConnectionResult`.
 */
export function mapPayPalError(response: Response, body?: unknown): ConnectorError {
  const detail = extractMessage(response.status, response.statusText, body);

  switch (response.status) {
    case 400:
      return new ConnectorError(
        PAYPAL_ERROR_CODES.VALIDATION_FAILED,
        `PayPal rejected the request (${detail})`,
        { status: 400 }
      );
    case 401:
      return new InvalidCredentialsError(
        'paypal-business',
        `PayPal credentials invalid or expired (${detail})`
      );
    case 403:
      return new ConnectorError(
        PAYPAL_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `PayPal token lacks the required scope (${detail})`,
        { status: 403 }
      );
    case 404:
      return new ConnectorError(
        PAYPAL_ERROR_CODES.RESOURCE_NOT_FOUND,
        `PayPal resource not found (${detail})`,
        { status: 404 }
      );
    case 422:
      return new ConnectorError(
        PAYPAL_ERROR_CODES.VALIDATION_FAILED,
        `PayPal validation failed (${detail})`,
        { status: 422 }
      );
    case 429: {
      const retryAfter = response.headers.get('retry-after');
      return new ConnectorError(
        PAYPAL_ERROR_CODES.RATE_LIMITED,
        `PayPal rate limit exceeded (${detail})`,
        { status: 429, retryAfter }
      );
    }
    default:
      if (response.status >= 500) {
        return new ConnectorError(
          PAYPAL_ERROR_CODES.PROVIDER_ERROR,
          `PayPal is temporarily unavailable (${detail})`,
          { status: response.status }
        );
      }
      return new ConnectorError(
        PAYPAL_ERROR_CODES.UNKNOWN_ERROR,
        `Unexpected PayPal response (${detail})`,
        { status: response.status }
      );
  }
}

/** Wrap a network-level failure (timeout, DNS, refused). */
export function paypalNetworkError(reason: string): ConnectorError {
  return new ConnectorError(PAYPAL_ERROR_CODES.NETWORK_ERROR, `Could not reach PayPal: ${reason}`);
}

/** Raised when PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET env vars are missing. */
export function configurationIncomplete(): ConnectorError {
  return new ConnectorError(
    PAYPAL_ERROR_CODES.CONFIGURATION_INCOMPLETE,
    'PayPal Connect not yet configured. Framewise needs to register a PayPal app via developer.paypal.com.'
  );
}
