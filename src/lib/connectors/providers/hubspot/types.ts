/**
 * HubSpot CRM — types.
 *
 * First CRM connector. HubSpot's OAuth 2.0 flow gives us a
 * `crm.objects.contacts.read|write` scope on the customer's Hub so
 * the AI agent can push leads into their CRM as soon as they're
 * captured. Customer keeps the contacts; Framewise only carries a
 * Bearer token.
 */

/**
 * Response body for `POST https://api.hubapi.com/oauth/v1/token`.
 *
 * `expires_in` is in seconds (HubSpot's access tokens are short-lived
 * — typically 30 minutes). `refresh_token` is always present for
 * authorization-code grants and never expires unless revoked, so we
 * can quietly mint new access tokens forever.
 */
export interface HubSpotOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  /** Always lowercase `bearer` from HubSpot. */
  token_type: string;
}

/**
 * `GET /account-info/v3/details` shape. HubSpot calls this "account
 * info" but in CRM terms a "Hub" is the same thing as a portal.
 */
export interface HubSpotAccountInfo {
  /** Numeric Hub identifier. We persist as a string for consistency. */
  portalId: number;
  /**
   * Plan/tier of the connected account. Common values:
   *   - `STANDARD` (paid Hub)
   *   - `DEVELOPER_TEST_ACCOUNT` (sandbox-style, used for OAuth dev)
   *   - `APP_DEVELOPER` (HubSpot's internal developer accounts)
   *   - `SANDBOX` (dedicated sandbox under a paid Hub)
   */
  accountType: string;
  timeZone: string;
  companyCurrency: string;
  additionalCurrencies: string[];
  utcOffset: string;
  utcOffsetMilliseconds: number;
  /**
   * UI domain for the connected Hub — e.g. `app.hubspot.com` for US
   * accounts, `app-eu1.hubspot.com` for EU-residency accounts. We
   * surface this as the connection's display name.
   */
  uiDomain: string;
  dataHostingLocation?: string;
}

/**
 * Subset of the token-response + account info we persist into
 * `provider_connections.metadata`. All fields optional so the
 * connection card can render gracefully when older rows lack newer
 * keys.
 */
export interface HubSpotMetadata {
  /** `portalId` cast to string so it lines up with the other connectors. */
  portal_id?: string;
  account_type?: string;
  company_currency?: string;
  ui_domain?: string;
  time_zone?: string;
  /**
   * ISO timestamp of when the access token expires. HubSpot rotates
   * access tokens frequently; future steps can use this to trigger a
   * background refresh before a 401.
   */
  expires_at?: string;
}

/** Minimal credentials persisted via the vault. */
export interface HubSpotCredentials {
  access_token: string;
  refresh_token: string;
  expires_at?: string;
}
