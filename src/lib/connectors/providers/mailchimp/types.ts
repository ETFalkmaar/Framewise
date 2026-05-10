/**
 * Mailchimp — types.
 *
 * Last connector — fase 6/7 complete. Mailchimp brings together a
 * few patterns from earlier providers:
 *   - OAuth flow (Stripe/PayPal/HubSpot/Pipedrive in steps 18–21).
 *   - Region-aware API host (Pipedrive in step 21 — different `dc`
 *     prefix per account, e.g. `us1.api.mailchimp.com`).
 *   - Free-tier badge on the connection card (Brevo in step 22).
 *
 * Two Mailchimp-specific quirks not seen elsewhere:
 *   - **3-step handshake**: token → metadata (to discover `dc`) →
 *     account (region-specific). The metadata endpoint is the only
 *     way to get the data center prefix.
 *   - **`Authorization: OAuth <token>`** (NOT `Bearer`). Tests
 *     assert this so a future "helpful" edit doesn't regress.
 *   - **No refresh tokens**: Mailchimp access tokens are
 *     permanent. `expires_in` from the token endpoint is usually 0.
 */

/**
 * Response body for `POST https://login.mailchimp.com/oauth2/token`.
 *
 * `expires_in` is 0 in practice — Mailchimp tokens don't expire.
 * `refresh_token` is intentionally absent (no rotation).
 * `scope` is usually `null` because Mailchimp doesn't use scopes.
 */
export interface MailchimpOAuthTokenResponse {
  access_token: string;
  /** Always 0 in practice — Mailchimp tokens never expire. */
  expires_in: number;
  /** Almost always `null` — Mailchimp doesn't ship a scopes system. */
  scope: string | null;
}

/**
 * Response body for `GET https://login.mailchimp.com/oauth2/metadata`.
 *
 * This is the ONLY way to discover the account's data center prefix
 * (`dc`) — the API base URL is a function of `dc`. We cache both the
 * `dc` and the resolved `api_endpoint` on the connection so future
 * REST calls don't need to call this endpoint again.
 */
export interface MailchimpMetadata {
  /** Data-center prefix, e.g. `us1`, `us2`, `eu1`. */
  dc: string;
  /** User's role on the connected account (e.g. `owner`, `admin`). */
  role: string;
  accountname: string;
  user_id: number;
  login: {
    email: string;
    avatar: string | null;
    login_id: number;
    login_name: string;
    login_email: string;
  };
  login_url: string;
  /** Region-specific REST root, e.g. `https://us1.api.mailchimp.com`. */
  api_endpoint: string;
}

/**
 * Response body for `GET /3.0/` (the API root). Mailchimp's "ping"
 * endpoint, but it returns rich account info — we surface a lot of
 * it on the connection card.
 */
export interface MailchimpAccount {
  account_id: string;
  login_id: string;
  account_name: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  avatar_url?: string;
  role: string;
  member_since: string;
  /** `monthly` | `pay_as_you_go` | `forever_free`. */
  pricing_plan_type: string;
  first_payment?: string | null;
  account_timezone: string;
  account_industry?: string;
  contact?: {
    company?: string;
    addr1?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  pro_enabled?: boolean;
  last_login: string;
  total_subscribers: number;
}

/**
 * Subset of metadata + account we persist into
 * `provider_connections.metadata`. All fields optional so the
 * connection card can render gracefully when older rows lack newer
 * keys.
 */
export interface MailchimpConnectorMetadata {
  account_id?: string;
  account_name?: string;
  email?: string;
  /** Login email from the metadata endpoint — may differ from `email` for delegated access. */
  login_email?: string;
  full_name?: string;
  /** Data-center prefix from the metadata endpoint. */
  dc?: string;
  /** Region-specific REST root, e.g. `https://us1.api.mailchimp.com`. */
  api_endpoint?: string;
  pricing_plan_type?: string;
  total_subscribers?: number;
  /** Mirrors Brevo: `true` when on the Forever Free plan. */
  is_free_tier?: boolean;
  account_timezone?: string;
}

/** Minimal credentials persisted via the vault. */
export interface MailchimpCredentials {
  access_token: string;
  /** Cached so future REST calls skip the metadata fetch. */
  api_endpoint: string;
  dc: string;
}
