/**
 * Pipedrive CRM — types.
 *
 * Second CRM connector. Pipedrive is a sales-focused CRM (deal
 * pipelines as the central abstraction); HubSpot covers the
 * marketing-CRM angle. They live side-by-side under the `crm`
 * category so customers can pick the one that fits their team.
 *
 * Region-specific API: each Pipedrive company has its own
 * `<company>.pipedrive.com` API domain. The OAuth token response
 * tells us which one we're authorised against via the `api_domain`
 * field — we cache it on the connection and use it for every
 * subsequent REST call.
 */

/**
 * Response body for `POST https://oauth.pipedrive.com/oauth/token`.
 *
 * `expires_in` is in seconds (Pipedrive's access tokens last 1 hour).
 * `refresh_token` is always present for authorization-code grants
 * and rotates on every refresh — same pattern as HubSpot.
 *
 * `api_domain` is the region-specific REST base URL — we cache it
 * on the credentials so the client knows where to send requests.
 */
export interface PipedriveOAuthTokenResponse {
  access_token: string;
  /** Always lowercase `bearer` from Pipedrive. */
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  /** Region-specific REST root, e.g. `https://framewise-test.pipedrive.com`. */
  api_domain: string;
}

/**
 * `GET /api/v1/users/me` shape, unwrapped from Pipedrive's
 * `{ success, data }` envelope. We only model the fields we surface
 * on the connections card.
 */
export interface PipedriveUser {
  id: number;
  name: string;
  email: string;
  default_currency: string;
  locale: string;
  /** Numeric language id (1 = English, …). Kept opaque for now. */
  lang: number;
  language?: {
    language_code?: string;
    country_code?: string;
  };
  timezone_name?: string;
  /** Numeric Pipedrive company identifier. We persist as a string. */
  company_id: number;
  company_name: string;
  /**
   * Slug-style identifier — appears in the API URL as
   * `<company_domain>.pipedrive.com`. We persist it for display
   * (the `api_domain` already includes it).
   */
  company_domain: string;
}

/**
 * Subset of the token-response + user info that we persist into
 * `provider_connections.metadata`. All fields optional so the
 * connection card can render gracefully when older rows lack newer
 * keys.
 */
export interface PipedriveMetadata {
  user_id?: string;
  user_name?: string;
  company_id?: string;
  company_name?: string;
  company_domain?: string;
  /** Region-specific REST root captured at connect time. */
  api_domain?: string;
  locale?: string;
  currency?: string;
}

/** Minimal credentials persisted via the vault. */
export interface PipedriveCredentials {
  access_token: string;
  refresh_token: string;
  /**
   * Region-specific REST root. Future steps that hit Pipedrive's
   * REST API will read this from the vault to avoid having to call
   * `/users/me` again just to discover the company domain.
   */
  api_domain: string;
  expires_at?: string;
}

/**
 * Pipedrive's REST envelope. Every response is wrapped in
 * `{ success: true, data: T, additional_data?: ... }`. The client
 * unwraps `data` for callers.
 */
export interface PipedriveEnvelope<T> {
  success: boolean;
  data: T;
  additional_data?: unknown;
}
