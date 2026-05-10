// Same circular-dep avoidance as previous providers: import from
// internal files, not the `@/lib/connectors` barrel.
import { ConnectorError, InvalidCredentialsError } from '../../errors';

/**
 * HubSpot-specific error codes added on top of the framework's
 * standard `CONNECTOR_ERROR_CODES`. Same convention as previous
 * providers — we only widen the set when the call site needs to
 * distinguish a failure mode (UI copy, retry policy, etc.).
 */
export const HUBSPOT_ERROR_CODES = {
  /** Bad request body / invalid OAuth grant (400). */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Token lacks the required scope or app permissions (403). */
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  /** Resource (contact, deal, …) not found (404). */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  /** HubSpot rate-limited us (429). HubSpot publishes daily + per-10s caps. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** HubSpot-side transient error (5xx). */
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  /** Network-level failure (DNS, timeout, refused). */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET env vars missing. */
  CONFIGURATION_INCOMPLETE: 'CONFIGURATION_INCOMPLETE',
  /** Anything outside the explicit switch — message includes the body. */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * HubSpot's REST envelope is consistent across endpoints:
 *   {
 *     "status": "error",
 *     "message": "...",
 *     "correlationId": "uuid",
 *     "category": "VALIDATION_ERROR" | "MISSING_SCOPES" | …
 *   }
 *
 * OAuth errors use the standard OAuth shape:
 *   { "status": "BAD_AUTH_CODE", "message": "..." }
 *
 * Both surface the human-readable text under `message`; we lift
 * `category` (when present) into the error message because it tells
 * the user what's actually missing (e.g. "MISSING_SCOPES").
 */
function extractMessage(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;

    const message = typeof obj.message === 'string' ? obj.message : null;
    const category = typeof obj.category === 'string' ? obj.category : null;

    if (message && category) return `${category}: ${message}`;
    if (message) return message;
    if (category) return category;

    // Fallback to OAuth-shape `error_description`.
    if (typeof obj.error_description === 'string' && obj.error_description.length > 0) {
      return obj.error_description as string;
    }
    if (typeof obj.error === 'string' && obj.error.length > 0) return obj.error as string;
    if (typeof obj.status === 'string' && obj.status.length > 0 && obj.status !== 'error') {
      return obj.status as string;
    }
  }

  if (typeof body === 'string' && body.length > 0 && body.length < 500) return body;
  return `${status} ${statusText}`.trim();
}

/**
 * Translate a HubSpot HTTP response to a typed framework error.
 * Always returns (never throws) — the caller decides whether to
 * `throw` or fold into a `TestConnectionResult`.
 */
export function mapHubSpotError(response: Response, body?: unknown): ConnectorError {
  const detail = extractMessage(response.status, response.statusText, body);

  switch (response.status) {
    case 400:
      return new ConnectorError(
        HUBSPOT_ERROR_CODES.VALIDATION_FAILED,
        `HubSpot rejected the request (${detail})`,
        { status: 400 }
      );
    case 401:
      return new InvalidCredentialsError(
        'hubspot',
        `HubSpot credentials invalid or expired (${detail})`
      );
    case 403:
      return new ConnectorError(
        HUBSPOT_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `HubSpot token lacks the required scope (${detail})`,
        { status: 403 }
      );
    case 404:
      return new ConnectorError(
        HUBSPOT_ERROR_CODES.RESOURCE_NOT_FOUND,
        `HubSpot resource not found (${detail})`,
        { status: 404 }
      );
    case 429: {
      const retryAfter = response.headers.get('retry-after');
      return new ConnectorError(
        HUBSPOT_ERROR_CODES.RATE_LIMITED,
        `HubSpot rate limit exceeded (${detail})`,
        { status: 429, retryAfter }
      );
    }
    default:
      if (response.status >= 500) {
        return new ConnectorError(
          HUBSPOT_ERROR_CODES.PROVIDER_ERROR,
          `HubSpot is temporarily unavailable (${detail})`,
          { status: response.status }
        );
      }
      return new ConnectorError(
        HUBSPOT_ERROR_CODES.UNKNOWN_ERROR,
        `Unexpected HubSpot response (${detail})`,
        { status: response.status }
      );
  }
}

/** Wrap a network-level failure (timeout, DNS, refused). */
export function hubspotNetworkError(reason: string): ConnectorError {
  return new ConnectorError(
    HUBSPOT_ERROR_CODES.NETWORK_ERROR,
    `Could not reach HubSpot: ${reason}`
  );
}

/** Raised when HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET env vars are missing. */
export function configurationIncomplete(): ConnectorError {
  return new ConnectorError(
    HUBSPOT_ERROR_CODES.CONFIGURATION_INCOMPLETE,
    'HubSpot Connect not yet configured. Framewise needs to register a HubSpot app via developers.hubspot.com.'
  );
}
