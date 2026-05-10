// Same circular-dep avoidance as previous providers: import from
// internal files, not the `@/lib/connectors` barrel.
import { ConnectorError, InvalidCredentialsError } from '../../errors';

/**
 * Pipedrive-specific error codes added on top of the framework's
 * standard `CONNECTOR_ERROR_CODES`.
 */
export const PIPEDRIVE_ERROR_CODES = {
  /** Bad request body / invalid OAuth grant (400, 422). */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Token lacks the required scope or app permissions (403). */
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  /** Resource (user, deal, contact) not found (404). */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  /** Pipedrive rate-limited us (429). Pipedrive's cap is 100 req / 2s per token. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Pipedrive-side transient error (5xx). */
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  /** Network-level failure (DNS, timeout, refused). */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** PIPEDRIVE_CLIENT_ID / PIPEDRIVE_CLIENT_SECRET env vars missing. */
  CONFIGURATION_INCOMPLETE: 'CONFIGURATION_INCOMPLETE',
  /** Anything outside the explicit switch — message includes the body. */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Pipedrive's REST envelope is consistent across endpoints:
 *   {
 *     "success": false,
 *     "error": "Forbidden",
 *     "error_info": "Please refer to https://developers.pipedrive.com",
 *     "errorCode": 403
 *   }
 *
 * `error_info` is usually the most user-friendly text; `error` is a
 * short code-style label. We surface both when available.
 *
 * The OAuth endpoints use a slightly different shape:
 *   { "error": "invalid_grant", "error_description": "..." }
 */
function extractMessage(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;

    const errorInfo = typeof obj.error_info === 'string' ? obj.error_info : null;
    const error = typeof obj.error === 'string' ? obj.error : null;
    const errorDescription =
      typeof obj.error_description === 'string' ? obj.error_description : null;

    if (errorInfo && error) return `${error}: ${errorInfo}`;
    if (errorInfo) return errorInfo;
    if (error && errorDescription) return `${error}: ${errorDescription}`;
    if (errorDescription) return errorDescription;
    if (error) return error;

    if (typeof obj.message === 'string' && obj.message.length > 0) return obj.message;
  }

  if (typeof body === 'string' && body.length > 0 && body.length < 500) return body;
  return `${status} ${statusText}`.trim();
}

/**
 * Translate a Pipedrive HTTP response to a typed framework error.
 * Always returns (never throws) — the caller decides whether to
 * `throw` or fold into a `TestConnectionResult`.
 */
export function mapPipedriveError(response: Response, body?: unknown): ConnectorError {
  const detail = extractMessage(response.status, response.statusText, body);

  switch (response.status) {
    case 400:
      return new ConnectorError(
        PIPEDRIVE_ERROR_CODES.VALIDATION_FAILED,
        `Pipedrive rejected the request (${detail})`,
        { status: 400 }
      );
    case 401:
      return new InvalidCredentialsError(
        'pipedrive',
        `Pipedrive credentials invalid or expired (${detail})`
      );
    case 403:
      return new ConnectorError(
        PIPEDRIVE_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `Pipedrive token lacks the required scope (${detail})`,
        { status: 403 }
      );
    case 404:
      return new ConnectorError(
        PIPEDRIVE_ERROR_CODES.RESOURCE_NOT_FOUND,
        `Pipedrive resource not found (${detail})`,
        { status: 404 }
      );
    case 422:
      return new ConnectorError(
        PIPEDRIVE_ERROR_CODES.VALIDATION_FAILED,
        `Pipedrive validation failed (${detail})`,
        { status: 422 }
      );
    case 429: {
      const retryAfter = response.headers.get('retry-after');
      return new ConnectorError(
        PIPEDRIVE_ERROR_CODES.RATE_LIMITED,
        `Pipedrive rate limit exceeded (100 req / 2s per token) (${detail})`,
        { status: 429, retryAfter }
      );
    }
    default:
      if (response.status >= 500) {
        return new ConnectorError(
          PIPEDRIVE_ERROR_CODES.PROVIDER_ERROR,
          `Pipedrive is temporarily unavailable (${detail})`,
          { status: response.status }
        );
      }
      return new ConnectorError(
        PIPEDRIVE_ERROR_CODES.UNKNOWN_ERROR,
        `Unexpected Pipedrive response (${detail})`,
        { status: response.status }
      );
  }
}

/** Wrap a network-level failure (timeout, DNS, refused). */
export function pipedriveNetworkError(reason: string): ConnectorError {
  return new ConnectorError(
    PIPEDRIVE_ERROR_CODES.NETWORK_ERROR,
    `Could not reach Pipedrive: ${reason}`
  );
}

/** Raised when PIPEDRIVE_CLIENT_ID / PIPEDRIVE_CLIENT_SECRET env vars are missing. */
export function configurationIncomplete(): ConnectorError {
  return new ConnectorError(
    PIPEDRIVE_ERROR_CODES.CONFIGURATION_INCOMPLETE,
    'Pipedrive Connect not yet configured. Framewise needs to register a Pipedrive app via developers.pipedrive.com.'
  );
}
