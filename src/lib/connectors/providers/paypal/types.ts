/**
 * PayPal Business — types.
 *
 * Second OAuth payment connector. PayPal's "Log in with PayPal"
 * (LIPP) flow lets a customer hand us a `read-only` view of their
 * Business account: name, email, payer-id, merchant attributes. We
 * never touch the customer's balance — pure BYOA, just like Stripe
 * Connect Standard accounts (step 18).
 */

export type PayPalEnvironment = 'sandbox' | 'live';

/**
 * Response body for `POST /v1/oauth2/token` (form-urlencoded).
 *
 * `expires_in` is in seconds (typically 8 hours). PayPal returns a
 * `refresh_token` only when the originally requested scopes include
 * a long-lived attribute scope; we always include
 * `https://uri.paypal.com/services/paypalattributes` so it should
 * always be present, but the type keeps it optional so a downgraded
 * scope doesn't break parsing.
 */
export interface PayPalOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  /** Defence-in-depth nonce returned by PayPal — opaque to us. */
  nonce?: string;
}

/**
 * `GET /v1/identity/oauth2/userinfo?schema=paypalv1.1` shape.
 *
 * Most fields are optional because PayPal honours the user's
 * disclosure preferences — a merchant with strict privacy settings
 * may suppress everything except `user_id` and `email`.
 */
export interface PayPalUserInfo {
  /**
   * URL-format opaque identifier — e.g.
   * `https://www.paypal.com/webapps/auth/identity/user/abc123…`.
   * The trailing slug doubles as a stable account id.
   */
  user_id: string;
  /** Merchant's PayPal-account display name. May be a business or person. */
  name?: string;
  email?: string;
  email_verified?: boolean;
  /** PayPal's internal payer id (`payer_id` on transactions). */
  payer_id?: string;
  /** `"true"`/`"false"` string in some responses, boolean in others. */
  verified_account?: boolean | string;
  /** IANA-ish locale, e.g. `Europe/Amsterdam` or `en_US`. */
  zoneinfo?: string;
  locale?: string;
  /**
   * Arbitrary nested address blob — we surface only `country_code`
   * for the connection-card metadata.
   */
  address?: {
    country?: string;
    country_code?: string;
    locality?: string;
    region?: string;
  };
}

/**
 * Subset of `PayPalUserInfo` + token-response that we persist into
 * `provider_connections.metadata`. All fields optional so the
 * connection card can render gracefully when older rows lack newer
 * keys.
 */
export interface PayPalMetadata {
  user_id?: string;
  payer_id?: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  environment?: PayPalEnvironment;
  account_country?: string;
}

/** Minimal credentials persisted via the vault. */
export interface PayPalCredentials {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
}
