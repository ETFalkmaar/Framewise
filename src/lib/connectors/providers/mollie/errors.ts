// Same circular-dep avoidance as Moneybird/e-Boekhouden: import from
// internal files, not the `@/lib/connectors` barrel.
import { ConnectorError, InvalidCredentialsError } from '../../errors';

/**
 * Mollie-specific error codes added on top of the framework's
 * standard `CONNECTOR_ERROR_CODES`. Same convention as previous
 * provider modules: widen only when the call site needs to
 * distinguish the failure mode.
 */
export const MOLLIE_ERROR_CODES = {
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Mollie's error envelope is consistent across endpoints:
 *   { status: 422, title: "...", detail: "human-readable message" }
 * `detail` is the most useful for surfacing to users, but we fall
 * back through `title` and the HTTP status if it's missing.
 */
function extractMessage(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.detail === 'string') return obj.detail;
    if (typeof obj.title === 'string') return obj.title;
    if (typeof obj.message === 'string') return obj.message;
  }
  if (typeof body === 'string' && body.length > 0 && body.length < 500) return body;
  return `${status} ${statusText}`.trim();
}

/**
 * Translate a Mollie HTTP response to a typed framework error.
 * Always returns (never throws) — the caller decides whether to
 * `throw` or fold into a `TestConnectionResult`.
 */
export function mapMollieError(response: Response, body?: unknown): ConnectorError {
  const detail = extractMessage(response.status, response.statusText, body);

  switch (response.status) {
    case 401:
      return new InvalidCredentialsError('mollie', `Mollie API key invalid or revoked (${detail})`);
    case 403:
      return new ConnectorError(
        MOLLIE_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `Mollie key lacks the required scope (${detail})`,
        { status: 403 }
      );
    case 404:
      return new ConnectorError(
        MOLLIE_ERROR_CODES.RESOURCE_NOT_FOUND,
        `Mollie resource not found (${detail})`,
        { status: 404 }
      );
    case 422:
      return new ConnectorError(
        MOLLIE_ERROR_CODES.VALIDATION_FAILED,
        `Mollie rejected the request (${detail})`,
        { status: 422 }
      );
    case 429: {
      const retryAfter = response.headers.get('retry-after');
      return new ConnectorError(
        MOLLIE_ERROR_CODES.RATE_LIMITED,
        `Mollie rate limit exceeded (600/5min) (${detail})`,
        { status: 429, retryAfter }
      );
    }
    default:
      if (response.status >= 500) {
        return new ConnectorError(
          MOLLIE_ERROR_CODES.PROVIDER_ERROR,
          `Mollie is temporarily unavailable (${detail})`,
          { status: response.status }
        );
      }
      return new ConnectorError(
        MOLLIE_ERROR_CODES.UNKNOWN_ERROR,
        `Unexpected Mollie response (${detail})`,
        { status: response.status }
      );
  }
}

/** Wrap a network-level failure (timeout, DNS, refused). */
export function mollieNetworkError(reason: string): ConnectorError {
  return new ConnectorError(MOLLIE_ERROR_CODES.NETWORK_ERROR, `Could not reach Mollie: ${reason}`);
}
