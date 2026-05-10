/**
 * Subset of Mollie's REST resources we actually use.
 *
 * @see https://docs.mollie.com/reference/v2/
 */

/**
 * Live keys move real money; test keys are sandbox-only. The prefix
 * is the only practical way to tell them apart, so we surface the
 * distinction in metadata and badge it in the UI.
 */
export type MollieKeyType = 'test' | 'live';

/** Subset of `GET /v2/organizations/me`. */
export interface MollieOrganization {
  id: string;
  name: string;
  email: string;
  locale: string;
  address?: {
    streetAndNumber?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
  vatNumber?: string;
  registrationNumber?: string;
}

/**
 * Subset of `GET /v2/methods` items. Mollie returns
 * `_embedded.methods[]` — `MollieClient.listMethods()` extracts that
 * array so call sites don't deal with the envelope.
 */
export interface MolliePaymentMethod {
  id: string;
  description: string;
  image: { size1x: string; size2x: string };
  status: 'activated' | 'pending-review' | 'rejected';
}

/** Stored on `provider_connections.encrypted_token` after the wizard. */
export interface MollieCredentials {
  api_key: string;
}

/**
 * Cached on `provider_connections.metadata` so the connections card
 * renders "Connected to <org> (test mode)" without re-decrypting.
 */
export interface MollieMetadata {
  organization_id?: string;
  organization_name?: string;
  country?: string;
  key_type?: MollieKeyType;
  /** Sorted list of activated method ids (e.g. `['ideal', 'creditcard']`). */
  active_methods?: string[];
  active_methods_count?: number;
}
