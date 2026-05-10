/**
 * PayPal has two completely separate environments — `sandbox` (test
 * money, test accounts) and `live` (real money, real accounts). The
 * authorize URL, token URL, and API base URL all differ. We resolve
 * the active environment once from `PAYPAL_ENVIRONMENT` and thread it
 * through the rest of the connector.
 */

export type PayPalEnvironment = 'sandbox' | 'live';

const SANDBOX_AUTHORIZE_URL = 'https://www.sandbox.paypal.com/connect';
const LIVE_AUTHORIZE_URL = 'https://www.paypal.com/connect';
const SANDBOX_API_BASE_URL = 'https://api-m.sandbox.paypal.com';
const LIVE_API_BASE_URL = 'https://api-m.paypal.com';

/**
 * Resolve the active PayPal environment from `process.env`. Defaults
 * to `sandbox` whenever the env var is missing or set to anything
 * other than the literal `live` — fail-safe (we'd rather hit the
 * sandbox by accident than the live API).
 */
export function getPayPalEnvironment(): PayPalEnvironment {
  const raw = process.env.PAYPAL_ENVIRONMENT?.trim().toLowerCase();
  if (raw === 'live') return 'live';
  return 'sandbox';
}

/** Authorize-URL host. Different domain per environment. */
export function getPayPalAuthorizeBaseUrl(env: PayPalEnvironment): string {
  return env === 'live' ? LIVE_AUTHORIZE_URL : SANDBOX_AUTHORIZE_URL;
}

/** REST API base — `/v1/oauth2/token`, `/v1/identity/oauth2/userinfo`, etc. */
export function getPayPalApiBaseUrl(env: PayPalEnvironment): string {
  return env === 'live' ? LIVE_API_BASE_URL : SANDBOX_API_BASE_URL;
}
