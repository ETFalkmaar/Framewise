/**
 * Subset of Moneybird's `Administration` resource we actually use.
 * The full schema is much larger; only the fields we render or
 * validate against are captured here.
 *
 * @see https://developer.moneybird.com/api/administrations/
 */
export interface MoneybirdAdministration {
  id: string;
  name: string;
  language: string;
  currency: string;
  country: string;
  time_zone: string;
}

/**
 * Credentials stored in `provider_connections.encrypted_token` after a
 * successful API-key flow. `administration_id` is optional — when
 * absent we use the first administration the token can see.
 */
export interface MoneybirdCredentials {
  access_token: string;
  administration_id?: string;
}

/**
 * Connection-level metadata persisted on `provider_connections.metadata`
 * by `testConnection` so the UI can render "Connected to <admin>" without
 * decrypting the token on every render.
 */
export interface MoneybirdMetadata {
  primary_administration_id?: string;
  primary_administration_name?: string;
  administrations_count?: number;
}
