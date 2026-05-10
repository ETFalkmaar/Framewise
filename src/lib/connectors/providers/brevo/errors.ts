// Same circular-dep avoidance as previous providers: import from
// internal files, not the `@/lib/connectors` barrel.
import { ConnectorError, InvalidCredentialsError } from '../../errors';

/**
 * Brevo-specific error codes added on top of the framework's
 * standard `CONNECTOR_ERROR_CODES`.
 */
export const BREVO_ERROR_CODES = {
  /** Bad request body (400). */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Account out of credits / paid action attempted on free tier (402). */
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  /** Token lacks the required scope or app permissions (403). */
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  /** Resource (campaign, contact, list) not found (404). */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  /** Wrong HTTP method for the endpoint (405). */
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  /** Accept header / content negotiation issue (406). */
  NOT_ACCEPTABLE: 'NOT_ACCEPTABLE',
  /** Brevo rate-limited us (429). Brevo's cap is 600 req / 10s. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Brevo-side transient error (5xx). */
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  /** Network-level failure (DNS, timeout, refused). */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** Anything outside the explicit switch — message includes the body. */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Brevo's REST envelope is consistent across endpoints:
 *   { "code": "unauthorized", "message": "Key not found" }
 *
 * `code` is a stable short label (e.g. `unauthorized`,
 * `invalid_parameter`, `permission_denied`); `message` is the
 * human-readable text. We surface both when available.
 */
function extractMessage(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const code = typeof obj.code === 'string' ? obj.code : null;
    const message = typeof obj.message === 'string' ? obj.message : null;

    if (code && message) return `${code}: ${message}`;
    if (message) return message;
    if (code) return code;
  }

  if (typeof body === 'string' && body.length > 0 && body.length < 500) return body;
  return `${status} ${statusText}`.trim();
}

/**
 * Translate a Brevo HTTP response to a typed framework error.
 * Always returns (never throws) — the caller decides whether to
 * `throw` or fold into a `TestConnectionResult`.
 */
export function mapBrevoError(response: Response, body?: unknown): ConnectorError {
  const detail = extractMessage(response.status, response.statusText, body);

  switch (response.status) {
    case 400:
      return new ConnectorError(
        BREVO_ERROR_CODES.VALIDATION_FAILED,
        `Brevo rejected the request (${detail})`,
        { status: 400 }
      );
    case 401:
      return new InvalidCredentialsError('brevo', `Brevo API key invalid or revoked (${detail})`);
    case 402:
      return new ConnectorError(
        BREVO_ERROR_CODES.PAYMENT_REQUIRED,
        `Brevo account has insufficient credits (${detail})`,
        { status: 402 }
      );
    case 403:
      return new ConnectorError(
        BREVO_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `Brevo key lacks the required permissions (${detail})`,
        { status: 403 }
      );
    case 404:
      return new ConnectorError(
        BREVO_ERROR_CODES.RESOURCE_NOT_FOUND,
        `Brevo resource not found (${detail})`,
        { status: 404 }
      );
    case 405:
      return new ConnectorError(
        BREVO_ERROR_CODES.METHOD_NOT_ALLOWED,
        `Brevo endpoint does not allow this method (${detail})`,
        { status: 405 }
      );
    case 406:
      return new ConnectorError(
        BREVO_ERROR_CODES.NOT_ACCEPTABLE,
        `Brevo cannot satisfy the Accept header (${detail})`,
        { status: 406 }
      );
    case 429: {
      const retryAfter = response.headers.get('retry-after');
      return new ConnectorError(
        BREVO_ERROR_CODES.RATE_LIMITED,
        `Brevo rate limit exceeded (600 req / 10s) (${detail})`,
        { status: 429, retryAfter }
      );
    }
    default:
      if (response.status >= 500) {
        return new ConnectorError(
          BREVO_ERROR_CODES.PROVIDER_ERROR,
          `Brevo is temporarily unavailable (${detail})`,
          { status: response.status }
        );
      }
      return new ConnectorError(
        BREVO_ERROR_CODES.UNKNOWN_ERROR,
        `Unexpected Brevo response (${detail})`,
        { status: response.status }
      );
  }
}

/** Wrap a network-level failure (timeout, DNS, refused). */
export function brevoNetworkError(reason: string): ConnectorError {
  return new ConnectorError(BREVO_ERROR_CODES.NETWORK_ERROR, `Could not reach Brevo: ${reason}`);
}
