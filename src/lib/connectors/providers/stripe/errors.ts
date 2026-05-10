// Same circular-dep avoidance as previous providers: import from
// internal files, not the `@/lib/connectors` barrel.
import { ConnectorError, InvalidCredentialsError } from '../../errors';

/**
 * Stripe-specific error codes added on top of the framework's standard
 * `CONNECTOR_ERROR_CODES`. We only widen the set when the call site
 * needs to distinguish a failure mode (UI copy, retry policy, etc.).
 */
export const STRIPE_ERROR_CODES = {
  /** Stripe rejected the request for input reasons (400 family). */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Card declined / payment-action required (402). */
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  /** Token lacks the necessary scope or account status (403). */
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  /** Resource (account, payment intent, …) not found (404). */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  /** Stripe rate-limited us (429). Stripe sets `Retry-After`. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Stripe-side transient error (5xx). */
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  /** Network-level failure (DNS, timeout, refused). */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /**
   * Framewise's Connect platform is not configured (missing
   * STRIPE_CLIENT_ID or STRIPE_SECRET_KEY). Surfaced in dev when env
   * vars are blank and on prod when the operator hasn't completed the
   * Connect onboarding yet.
   */
  CONFIGURATION_INCOMPLETE: 'CONFIGURATION_INCOMPLETE',
  /** Anything outside the explicit switch — message includes the body. */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Stripe's standard error envelope:
 *   { "error": { "type": "...", "code": "...", "message": "..." } }
 * For OAuth-token errors the shape is slightly different:
 *   { "error": "invalid_grant", "error_description": "..." }
 * We try both before falling back to the HTTP status text.
 */
function extractMessage(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;

    // Standard `/v1/*` REST envelope.
    if (obj.error && typeof obj.error === 'object') {
      const err = obj.error as Record<string, unknown>;
      if (typeof err.message === 'string' && err.message.length > 0) return err.message;
      if (typeof err.code === 'string' && err.code.length > 0) return err.code;
    }

    // OAuth `/oauth/token` envelope.
    if (typeof obj.error === 'string' && obj.error.length > 0) {
      const desc = typeof obj.error_description === 'string' ? obj.error_description : null;
      return desc ? `${obj.error}: ${desc}` : obj.error;
    }

    if (typeof obj.message === 'string') return obj.message;
  }

  if (typeof body === 'string' && body.length > 0 && body.length < 500) return body;
  return `${status} ${statusText}`.trim();
}

/**
 * Translate a Stripe HTTP response to a typed framework error.
 * Always returns (never throws) — the caller decides whether to
 * `throw` or fold into a `TestConnectionResult`.
 */
export function mapStripeError(response: Response, body?: unknown): ConnectorError {
  const detail = extractMessage(response.status, response.statusText, body);

  switch (response.status) {
    case 400:
      return new ConnectorError(
        STRIPE_ERROR_CODES.VALIDATION_FAILED,
        `Stripe rejected the request (${detail})`,
        { status: 400 }
      );
    case 401:
      return new InvalidCredentialsError(
        'stripe',
        `Stripe credentials invalid or revoked (${detail})`
      );
    case 402:
      return new ConnectorError(
        STRIPE_ERROR_CODES.PAYMENT_REQUIRED,
        `Stripe requires action on this payment (${detail})`,
        { status: 402 }
      );
    case 403:
      return new ConnectorError(
        STRIPE_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `Stripe token lacks the required permissions (${detail})`,
        { status: 403 }
      );
    case 404:
      return new ConnectorError(
        STRIPE_ERROR_CODES.RESOURCE_NOT_FOUND,
        `Stripe resource not found (${detail})`,
        { status: 404 }
      );
    case 429: {
      const retryAfter = response.headers.get('retry-after');
      return new ConnectorError(
        STRIPE_ERROR_CODES.RATE_LIMITED,
        `Stripe rate limit exceeded (${detail})`,
        { status: 429, retryAfter }
      );
    }
    default:
      if (response.status >= 500) {
        return new ConnectorError(
          STRIPE_ERROR_CODES.PROVIDER_ERROR,
          `Stripe is temporarily unavailable (${detail})`,
          { status: response.status }
        );
      }
      return new ConnectorError(
        STRIPE_ERROR_CODES.UNKNOWN_ERROR,
        `Unexpected Stripe response (${detail})`,
        { status: response.status }
      );
  }
}

/** Wrap a network-level failure (timeout, DNS, refused). */
export function stripeNetworkError(reason: string): ConnectorError {
  return new ConnectorError(STRIPE_ERROR_CODES.NETWORK_ERROR, `Could not reach Stripe: ${reason}`);
}

/** Raised when STRIPE_CLIENT_ID / STRIPE_SECRET_KEY env vars are missing. */
export function configurationIncomplete(): ConnectorError {
  return new ConnectorError(
    STRIPE_ERROR_CODES.CONFIGURATION_INCOMPLETE,
    'Stripe Connect not yet configured. Framewise needs to register a Connect platform via dashboard.stripe.com.'
  );
}
