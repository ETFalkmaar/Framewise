import type {
  AuthMethod,
  CountryCode,
  LocalisedString,
  ProviderCategory,
  ProviderId,
} from '@/lib/countries';

/**
 * One field in an API-key wizard. The framework renders these as
 * inputs and runs `validation` client-side before submission.
 */
export interface ApiKeyField {
  key: string;
  label: LocalisedString;
  type: 'text' | 'password' | 'subdomain';
  required: boolean;
  placeholder?: string;
  validation?: {
    /** Source of a JS RegExp (no flags). Compiled both client + server. */
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

/**
 * Result returned by `connector.testConnection`. Used by the wizard
 * UI to either redirect to the connections list (on `ok: true`) or
 * surface the provider's error message (on `ok: false`).
 */
export interface TestConnectionResult {
  ok: boolean;
  error?: string;
  /** Anything provider-specific worth showing — account name, plan, … */
  metadata?: Record<string, unknown>;
}

/** Outcome of `refreshAccess` — same shape as the OAuth token response. */
export interface RefreshAccessResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

/**
 * Code-defined description of one connector. Stored in `connectorRegistry`
 * keyed by `id`; shared by the OAuth flow, the API-key wizard, and the
 * UI hub.
 */
export interface ConnectorDefinition {
  id: ProviderId;
  category: ProviderCategory;
  authMethod: AuthMethod;

  /**
   * `true` to hide the card in production (e.g. mock test connectors).
   * `developmentOnly` connectors still register so dev / playground /
   * tests see them; the hub component filters them out at render time
   * when `process.env.NODE_ENV === 'production'`.
   */
  developmentOnly?: boolean;

  /** Countries the connector should be offered in. Defaults to all. */
  availableIn?: CountryCode[];

  /** OAuth-specific config — required iff `authMethod === 'oauth'`. */
  oauth?: {
    authorizeUrl: string;
    tokenUrl: string;
    scopes: string[];
    requiresClientSecret: boolean;
    pkce: boolean;
  };

  /** API-key-specific config — required iff `authMethod === 'api_key'`. */
  apiKey?: {
    instructions: LocalisedString;
    fields: ApiKeyField[];
    helpUrl?: string;
  };

  /**
   * Optional credentials check after the flow completes. The framework
   * calls this with the just-received credentials before persisting.
   * Defaults to `{ ok: true }` (see `BaseConnector`).
   */
  testConnection?: (
    credentials: Record<string, string>,
    context: ConnectorContext
  ) => Promise<TestConnectionResult>;

  /**
   * Optional refresh-token exchange for OAuth providers. Step 14 wires
   * the API but doesn't call it yet; specific connectors in steps
   * 15–23 will plug in real exchanges.
   */
  refreshAccess?: (refreshToken: string) => Promise<RefreshAccessResult>;
}

/**
 * Per-call context captured at the request boundary and threaded
 * through every framework function. Maps 1:1 to what the audit log
 * records and what the vault expects (`VaultActor`).
 */
export interface ConnectorContext {
  tenantId: string;
  userId: string;
  ipAddress?: string | null;
  /** UI locale at the time of the call — used for translated error messages. */
  locale?: 'nl' | 'fr' | 'en';
}

/**
 * What flows hand back to the caller (route handler / server action).
 * `connectionId` is set on success; `error` is set on failure;
 * `redirectUrl` is set when the next step is a browser redirect
 * (e.g. OAuth `authorize_url`).
 */
export interface FlowResult {
  success: boolean;
  connectionId?: string;
  error?: string;
  redirectUrl?: string;
  /** Optional structured metadata returned by `testConnection`. */
  metadata?: Record<string, unknown>;
}

/**
 * Payload stored in the `framewise_oauth_flow` cookie for the duration
 * of an OAuth round-trip. Signed via HMAC; see `flows/shared.ts`.
 */
export interface FlowState {
  tenantId: string;
  userId: string;
  providerId: ProviderId;
  /** CSRF token echoed in the OAuth `state` query param. */
  state: string;
  /** PKCE verifier — present iff connector.oauth.pkce === true. */
  codeVerifier?: string;
  /** Epoch ms when this state expires; 10 minutes by default. */
  exp: number;
}
