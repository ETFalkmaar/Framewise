// Same circular-dep avoidance as Moneybird (step 15): import from
// internal files, not the `@/lib/connectors` barrel.
import { ConnectorError, InvalidCredentialsError } from '../../errors';

/**
 * e-Boekhouden-specific error codes added on top of the framework's
 * standard `CONNECTOR_ERROR_CODES`. Same convention as Moneybird:
 * widen only when the call site needs to distinguish the failure mode.
 */
export const EBOEKHOUDEN_ERROR_CODES = {
  CONFIGURATION_INCOMPLETE: 'CONFIGURATION_INCOMPLETE',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Best-effort message extraction from an e-Boekhouden response body.
 * The provider tends to return `{ message: "..." }` or
 * `{ errors: [{ field, message }] }`, with plaintext as a fallback.
 */
function extractMessage(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (Array.isArray(obj.errors)) {
      const flat = (obj.errors as unknown[])
        .map((e) => {
          if (e && typeof e === 'object') {
            const eo = e as Record<string, unknown>;
            const f = typeof eo.field === 'string' ? `${eo.field}: ` : '';
            const m = typeof eo.message === 'string' ? eo.message : JSON.stringify(eo);
            return `${f}${m}`;
          }
          return String(e);
        })
        .join('; ');
      if (flat) return flat;
    }
  }
  if (typeof body === 'string' && body.length > 0 && body.length < 500) return body;
  return `${status} ${statusText}`.trim();
}

/**
 * Translate an e-Boekhouden HTTP response to a typed framework error.
 *
 * Always returns (never throws) — same contract as Moneybird's helper.
 */
export function mapEBoekhoudenError(response: Response, body?: unknown): ConnectorError {
  const detail = extractMessage(response.status, response.statusText, body);

  switch (response.status) {
    case 400:
      return new ConnectorError(
        EBOEKHOUDEN_ERROR_CODES.VALIDATION_FAILED,
        `e-Boekhouden rejected the request (${detail})`,
        { status: 400 }
      );
    case 401:
      return new InvalidCredentialsError(
        'e-boekhouden',
        `e-Boekhouden token invalid or session expired (${detail})`
      );
    case 403:
      return new ConnectorError(
        EBOEKHOUDEN_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `e-Boekhouden token lacks the required scopes (${detail})`,
        { status: 403 }
      );
    case 404:
      return new ConnectorError(
        EBOEKHOUDEN_ERROR_CODES.RESOURCE_NOT_FOUND,
        `e-Boekhouden resource not found (${detail})`,
        { status: 404 }
      );
    case 429: {
      const retryAfter = response.headers.get('retry-after');
      return new ConnectorError(
        EBOEKHOUDEN_ERROR_CODES.RATE_LIMITED,
        `e-Boekhouden rate limit exceeded (1000/min) (${detail})`,
        { status: 429, retryAfter }
      );
    }
    default:
      if (response.status >= 500) {
        return new ConnectorError(
          EBOEKHOUDEN_ERROR_CODES.PROVIDER_ERROR,
          `e-Boekhouden is temporarily unavailable (${detail})`,
          { status: response.status }
        );
      }
      return new ConnectorError(
        EBOEKHOUDEN_ERROR_CODES.UNKNOWN_ERROR,
        `Unexpected e-Boekhouden response (${detail})`,
        { status: response.status }
      );
  }
}

/** Wrap a network-level failure (timeout, DNS, refused). */
export function networkError(reason: string): ConnectorError {
  return new ConnectorError(
    EBOEKHOUDEN_ERROR_CODES.NETWORK_ERROR,
    `Could not reach e-Boekhouden: ${reason}`
  );
}

/**
 * Returned when the integrator-level Source API Token isn't configured
 * via `EBOEKHOUDEN_SOURCE_API_TOKEN`. Friendly message because the
 * customer can't fix this themselves — only Framewise can.
 */
export function configurationIncomplete(): ConnectorError {
  return new ConnectorError(
    EBOEKHOUDEN_ERROR_CODES.CONFIGURATION_INCOMPLETE,
    'e-Boekhouden integration not yet configured. Framewise needs to request a Source API Token from support@e-boekhouden.nl before this connector can work.'
  );
}
