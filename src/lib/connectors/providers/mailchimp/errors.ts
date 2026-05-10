// Same circular-dep avoidance as previous providers: import from
// internal files, not the `@/lib/connectors` barrel.
import { ConnectorError, InvalidCredentialsError } from '../../errors';

/**
 * Mailchimp-specific error codes added on top of the framework's
 * standard `CONNECTOR_ERROR_CODES`.
 */
export const MAILCHIMP_ERROR_CODES = {
  /** Bad request body / invalid OAuth grant (400, 422). */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Token lacks the required permissions (403). */
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  /** Resource (list, member, campaign) not found (404). */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  /** Mailchimp rate-limited us (429). MC's cap is 10 simultaneous connections. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Mailchimp-side transient error (5xx). */
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  /** Network-level failure (DNS, timeout, refused). */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** MAILCHIMP_CLIENT_ID / MAILCHIMP_CLIENT_SECRET env vars missing. */
  CONFIGURATION_INCOMPLETE: 'CONFIGURATION_INCOMPLETE',
  /** Anything outside the explicit switch — message includes the body. */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Mailchimp's error envelope follows RFC 7807 Problem Details:
 *   {
 *     "type": "https://mailchimp.com/developer/marketing/docs/errors/",
 *     "title": "API Key Invalid",
 *     "status": 401,
 *     "detail": "Your API key may be invalid, ...",
 *     "instance": "uuid"
 *   }
 *
 * `detail` is the user-friendly text; `title` is a short code-style
 * label. We surface both when available.
 *
 * The OAuth endpoints use a slightly different shape:
 *   { "error": "invalid_grant", "error_description": "..." }
 */
function extractMessage(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;

    const detail = typeof obj.detail === 'string' ? obj.detail : null;
    const title = typeof obj.title === 'string' ? obj.title : null;

    if (title && detail) return `${title}: ${detail}`;
    if (detail) return detail;
    if (title) return title;

    // OAuth-style envelope.
    const error = typeof obj.error === 'string' ? obj.error : null;
    const errorDescription =
      typeof obj.error_description === 'string' ? obj.error_description : null;
    if (error && errorDescription) return `${error}: ${errorDescription}`;
    if (errorDescription) return errorDescription;
    if (error) return error;

    if (typeof obj.message === 'string' && obj.message.length > 0) return obj.message;
  }

  if (typeof body === 'string' && body.length > 0 && body.length < 500) return body;
  return `${status} ${statusText}`.trim();
}

/**
 * Translate a Mailchimp HTTP response to a typed framework error.
 * Always returns (never throws) — the caller decides whether to
 * `throw` or fold into a `TestConnectionResult`.
 */
export function mapMailchimpError(response: Response, body?: unknown): ConnectorError {
  const detail = extractMessage(response.status, response.statusText, body);

  switch (response.status) {
    case 400:
      return new ConnectorError(
        MAILCHIMP_ERROR_CODES.VALIDATION_FAILED,
        `Mailchimp rejected the request (${detail})`,
        { status: 400 }
      );
    case 401:
      return new InvalidCredentialsError(
        'mailchimp',
        `Mailchimp credentials invalid or expired (${detail})`
      );
    case 403:
      return new ConnectorError(
        MAILCHIMP_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `Mailchimp token lacks the required permissions (${detail})`,
        { status: 403 }
      );
    case 404:
      return new ConnectorError(
        MAILCHIMP_ERROR_CODES.RESOURCE_NOT_FOUND,
        `Mailchimp resource not found (${detail})`,
        { status: 404 }
      );
    case 422:
      return new ConnectorError(
        MAILCHIMP_ERROR_CODES.VALIDATION_FAILED,
        `Mailchimp validation failed (${detail})`,
        { status: 422 }
      );
    case 429: {
      const retryAfter = response.headers.get('retry-after');
      return new ConnectorError(
        MAILCHIMP_ERROR_CODES.RATE_LIMITED,
        `Mailchimp rate limit exceeded (10 simultaneous connections) (${detail})`,
        { status: 429, retryAfter }
      );
    }
    default:
      if (response.status >= 500) {
        return new ConnectorError(
          MAILCHIMP_ERROR_CODES.PROVIDER_ERROR,
          `Mailchimp is temporarily unavailable (${detail})`,
          { status: response.status }
        );
      }
      return new ConnectorError(
        MAILCHIMP_ERROR_CODES.UNKNOWN_ERROR,
        `Unexpected Mailchimp response (${detail})`,
        { status: response.status }
      );
  }
}

/** Wrap a network-level failure (timeout, DNS, refused). */
export function mailchimpNetworkError(reason: string): ConnectorError {
  return new ConnectorError(
    MAILCHIMP_ERROR_CODES.NETWORK_ERROR,
    `Could not reach Mailchimp: ${reason}`
  );
}

/** Raised when MAILCHIMP_CLIENT_ID / MAILCHIMP_CLIENT_SECRET env vars are missing. */
export function configurationIncomplete(): ConnectorError {
  return new ConnectorError(
    MAILCHIMP_ERROR_CODES.CONFIGURATION_INCOMPLETE,
    'Mailchimp Connect not yet configured. Framewise needs to register a Mailchimp app via login.mailchimp.com → Profile → Extras → Registered apps.'
  );
}
