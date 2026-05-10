// Same circular-dep avoidance as `connector.ts`: import from internal
// files, not the `@/lib/connectors` barrel.
import { ConnectorError, InvalidCredentialsError } from '../../errors';

/**
 * Moneybird-specific error codes added on top of the framework's
 * standard `CONNECTOR_ERROR_CODES`. We only widen the list when we
 * need to distinguish the failure mode at the call site (e.g. the
 * UI surfaces "rate limited" differently from "provider down").
 */
export const MONEYBIRD_ERROR_CODES = {
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Pull a human-readable error message out of Moneybird's response
 * body. The provider sometimes returns `{ error: "..." }`, sometimes
 * `{ errors: { field: [...] } }`, sometimes plain text. We try each
 * shape and fall back to the HTTP status text.
 */
function extractMessage(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.message === 'string') return obj.message;
    if (obj.errors && typeof obj.errors === 'object') {
      const flat = Object.entries(obj.errors as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
        .join('; ');
      if (flat) return flat;
    }
  }
  if (typeof body === 'string' && body.length > 0 && body.length < 500) return body;
  return `${status} ${statusText}`.trim();
}

/**
 * Translate a Moneybird HTTP response to a typed framework error.
 *
 * Always returns (never throws) — the caller decides whether to
 * `throw` so the call site can route the error through both paths
 * (`testConnection` swallows; client wrappers re-throw).
 */
export function mapMoneybirdError(response: Response, body?: unknown): ConnectorError {
  const detail = extractMessage(response.status, response.statusText, body);

  switch (response.status) {
    case 401:
      return new InvalidCredentialsError(
        'moneybird',
        `Moneybird token invalid or expired (${detail})`
      );
    case 403:
      return new ConnectorError(
        MONEYBIRD_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `Moneybird token lacks permission for this resource (${detail})`,
        { status: 403 }
      );
    case 404:
      return new ConnectorError(
        MONEYBIRD_ERROR_CODES.RESOURCE_NOT_FOUND,
        `Moneybird resource not found (${detail})`,
        { status: 404 }
      );
    case 422:
      return new ConnectorError(
        MONEYBIRD_ERROR_CODES.VALIDATION_FAILED,
        `Moneybird rejected the request (${detail})`,
        { status: 422 }
      );
    case 429: {
      const retryAfter = response.headers.get('retry-after');
      return new ConnectorError(
        MONEYBIRD_ERROR_CODES.RATE_LIMITED,
        `Moneybird rate limit exceeded (${detail})`,
        { status: 429, retryAfter }
      );
    }
    default:
      if (response.status >= 500) {
        return new ConnectorError(
          MONEYBIRD_ERROR_CODES.PROVIDER_ERROR,
          `Moneybird is temporarily unavailable (${detail})`,
          { status: response.status }
        );
      }
      return new ConnectorError(
        MONEYBIRD_ERROR_CODES.UNKNOWN_ERROR,
        `Unexpected Moneybird response (${detail})`,
        { status: response.status }
      );
  }
}

/**
 * Wrap a network-level failure (timeout, DNS, refused) into a
 * `ConnectorError`. Distinct from `mapMoneybirdError` because we never
 * have a `Response` here — the request never completed.
 */
export function networkError(reason: string): ConnectorError {
  return new ConnectorError(
    MONEYBIRD_ERROR_CODES.NETWORK_ERROR,
    `Could not reach Moneybird: ${reason}`
  );
}
