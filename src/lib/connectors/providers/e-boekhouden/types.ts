/**
 * Subset of e-Boekhouden's REST resources we actually use.
 *
 * @see https://api.e-boekhouden.nl/swagger/index.html
 */

/** Response from `POST /session` — short-lived bearer for subsequent calls. */
export interface EBoekhoudenSessionResponse {
  token: string;
  /** Expiry as ISO-8601 datetime string (provider guarantees ≥ 60 min). */
  expires: string;
}

/** Subset of `GET /administration` — the wizard's primary metadata source. */
export interface EBoekhoudenAdministration {
  id: string;
  name: string;
  vatNumber?: string;
  country: string;
  currency: string;
}

/** Stored on `provider_connections.encrypted_token` after a successful flow. */
export interface EBoekhoudenCredentials {
  user_api_token: string;
}

/**
 * Cached on `provider_connections.metadata` so the connections card
 * renders "Connected to <admin>" without re-decrypting the token.
 *
 * `last_session_at` records the most recent successful `testConnection`
 * — useful for support / diagnostics.
 */
export interface EBoekhoudenMetadata {
  administration_name?: string;
  administration_country?: string;
  vat_number?: string;
  last_session_at?: string;
}
