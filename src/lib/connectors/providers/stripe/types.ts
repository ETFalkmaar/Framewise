/**
 * Stripe Connect — types.
 *
 * Stripe Connect Standard accounts. The customer keeps a full Stripe
 * Dashboard, money lands on their own bank account, and Framewise
 * holds nothing more than a `read_write` access token plus the
 * `acct_xxx` identifier we got back from the OAuth handshake.
 *
 * All fields here are intentionally minimal — we only model what the
 * `testConnection` (post-callback) flow surfaces to the UI. Future
 * payment-creation steps will extend `StripeAccount` and add new
 * shapes (PaymentIntent, Charge, etc.) as needed.
 */

/**
 * Response body for `POST https://connect.stripe.com/oauth/token`.
 *
 * `livemode` is the single source of truth for whether the connected
 * account is a real-money account or a test account. We mirror it
 * onto `provider_connections.metadata.livemode` so the UI can show a
 * coloured badge (amber test / emerald live), the same pattern used
 * for Mollie's `key_type`.
 */
export interface StripeOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  /** Stripe account identifier of the connected customer (`acct_xxx`). */
  stripe_user_id: string;
  /** Publishable key for the connected account — useful for client-side SDKs later. */
  stripe_publishable_key: string;
  /** Granted scopes — always `read_write` for Standard accounts in this app. */
  scope: string;
  /** `false` when the connected account is a Stripe test-mode account. */
  livemode: boolean;
  /** Always `bearer` for OAuth-issued tokens. */
  token_type: string;
}

/**
 * `GET /v1/accounts/{id}` (or `/v1/account` when called with the
 * connected account's own access token). We only model the fields
 * surfaced in the connection card.
 */
export interface StripeAccount {
  id: string;
  business_profile: {
    name: string | null;
    url: string | null;
    support_email: string | null;
  } | null;
  country: string;
  default_currency: string;
  email: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
}

/**
 * Subset of `StripeAccount` + token-response that we persist into
 * `provider_connections.metadata`. All fields optional so the
 * connection card can render gracefully when older rows lack newer
 * keys (e.g. after an older callback that didn't fetch `business_profile.name`).
 */
export interface StripeMetadata {
  stripe_user_id?: string;
  account_country?: string;
  account_currency?: string;
  business_name?: string;
  livemode?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
}

/** Minimal credentials persisted via the vault. */
export interface StripeCredentials {
  access_token: string;
  refresh_token?: string;
  stripe_user_id?: string;
}
