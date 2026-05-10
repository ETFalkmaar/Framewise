import { storeCredentials } from '../base';
import {
  CONNECTOR_ERROR_CODES,
  ConnectorError,
  FlowAbortedError,
  InvalidCredentialsError,
  StateValidationError,
  UnsupportedFlowError,
} from '../errors';
import type { ConnectorContext, ConnectorDefinition, FlowResult, FlowState } from '../types';
import {
  FLOW_STATE_TTL_MS,
  generatePkcePair,
  generateState,
  packFlowState,
  unpackFlowState,
} from './shared';

export interface InitiateOAuthInput {
  connector: ConnectorDefinition;
  context: ConnectorContext;
  /** Absolute URL the provider will redirect to (e.g. https://app/api/connectors/oauth/callback). */
  callbackUrl: string;
}

export interface InitiateOAuthResult {
  /** Where to send the browser. */
  authorizeUrl: string;
  /** Cookie value to set; route handler is responsible for the Set-Cookie. */
  flowStateCookie: string;
  /** The CSRF state echoed in `authorizeUrl` — exposed for tests. */
  state: string;
}

/**
 * Build the provider's `authorize_url` and the signed cookie payload
 * that the callback handler will validate. Stateless — no DB writes
 * yet; the actual `provider_connections` row is created by
 * `handleOAuthCallback` on success.
 */
export async function initiateOAuthFlow(input: InitiateOAuthInput): Promise<InitiateOAuthResult> {
  const { connector, context, callbackUrl } = input;
  if (connector.authMethod !== 'oauth' || !connector.oauth) {
    throw new UnsupportedFlowError(connector.id, 'oauth');
  }

  const state = generateState();
  const pkce = connector.oauth.pkce ? generatePkcePair() : null;

  const flowState: FlowState = {
    tenantId: context.tenantId,
    userId: context.userId,
    providerId: connector.id,
    state,
    codeVerifier: pkce?.codeVerifier,
    exp: Date.now() + FLOW_STATE_TTL_MS,
  };

  // Per-connector override (Stripe, …): the connector knows about its
  // own client_id env var and the provider's exact query-string shape.
  // Falls back to the generic builder for the framework's mock and
  // for connectors without provider-specific params.
  let authorizeUrl: string;
  if (connector.getAuthorizeUrl) {
    authorizeUrl = await connector.getAuthorizeUrl({ state, callbackUrl });
  } else {
    const url = new URL(connector.oauth.authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('scope', connector.oauth.scopes.join(' '));
    url.searchParams.set('state', state);
    // client_id is connector-specific in real life — for the framework
    // we use a placeholder so the URL is well-formed. Step 15+ will
    // pass real client ids from env vars.
    url.searchParams.set('client_id', `framewise-${connector.id}`);
    if (pkce) {
      url.searchParams.set('code_challenge', pkce.codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }
    authorizeUrl = url.toString();
  }

  return {
    authorizeUrl,
    flowStateCookie: packFlowState(flowState),
    state,
  };
}

/**
 * Internal token-exchange seam. Step 15+ replaces this with a real
 * `fetch` per connector; until then we mint a deterministic stub so
 * the framework can be tested end-to-end without external HTTP.
 *
 * Recognises `connector.oauth.tokenUrl` containing
 * `mock.connectors.test` as a signal that the stub is wanted; any
 * other URL throws so a half-implemented real connector fails loudly
 * during development.
 */
async function exchangeCodeForToken(
  connector: ConnectorDefinition,
  code: string,
  codeVerifier?: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: string | null }> {
  const tokenUrl = connector.oauth?.tokenUrl ?? '';
  const isMock = tokenUrl.includes('mock.connectors.test');
  if (!isMock) {
    throw new ConnectorError(
      CONNECTOR_ERROR_CODES.TOKEN_EXCHANGE_FAILED,
      `No real token-exchange implementation for connector "${connector.id}" — use a mock URL or implement in step 15+`
    );
  }
  // Deterministic stub. PKCE verifier is folded in just so PKCE-enabled
  // tests can assert it was carried through.
  return {
    accessToken: `mock_oauth_${connector.id}_${code.slice(0, 8)}${codeVerifier ? '_pkce' : ''}`,
    refreshToken: `mock_refresh_${connector.id}`,
    expiresAt: null,
  };
}

export interface HandleOAuthCallbackInput {
  /** Value from the `state` query parameter. */
  state: string;
  /** Value from the `code` query parameter. */
  code: string | null | undefined;
  /** Raw cookie payload from `framewise_oauth_flow` (signed). */
  flowStateCookie: string | null | undefined;
  /** Connector that should receive the credentials. */
  connector: ConnectorDefinition;
  /** Optional explicit override of the actor (for testing); defaults to the cookie payload. */
  contextOverride?: Partial<ConnectorContext>;
}

/**
 * Validate the OAuth callback, exchange the code for a token, persist
 * the credentials via the vault, and return a `FlowResult`. Designed
 * for use from a Next.js route handler.
 *
 * - `state` mismatch / missing cookie / expired cookie →
 *   `StateValidationError`.
 * - Provider returned no `code` → `FlowAbortedError`.
 * - `connector.testConnection` rejected the freshly-issued token →
 *   `InvalidCredentialsError`.
 */
export async function handleOAuthCallback(input: HandleOAuthCallbackInput): Promise<FlowResult> {
  const { state, code, flowStateCookie, connector, contextOverride } = input;

  if (connector.authMethod !== 'oauth' || !connector.oauth) {
    throw new UnsupportedFlowError(connector.id, 'oauth');
  }

  const flowState = unpackFlowState(flowStateCookie);
  if (!flowState) {
    throw new StateValidationError('Missing, expired or tampered OAuth flow state');
  }
  if (flowState.state !== state) {
    throw new StateValidationError('OAuth state parameter does not match cookie');
  }
  if (flowState.providerId !== connector.id) {
    throw new StateValidationError(
      `OAuth flow was initiated for "${flowState.providerId}" but callback is for "${connector.id}"`
    );
  }
  if (!code) {
    throw new FlowAbortedError();
  }

  const context: ConnectorContext = {
    tenantId: contextOverride?.tenantId ?? flowState.tenantId,
    userId: contextOverride?.userId ?? flowState.userId,
    ipAddress: contextOverride?.ipAddress ?? null,
    locale: contextOverride?.locale,
  };

  // Per-connector override (Stripe, …): the connector owns the entire
  // exchange + verification cycle and hands back ready-to-persist
  // credentials + metadata. Falls back to the framework's mock token
  // exchange for connectors without an override.
  let credentials: Record<string, string>;
  let metadata: Record<string, unknown> | undefined;

  if (connector.handleOAuthCallback) {
    const result = await connector.handleOAuthCallback({ code, state, context });
    if (!result.ok) {
      throw new InvalidCredentialsError(connector.id, result.error);
    }
    if (!result.credentials || !result.credentials.access_token) {
      throw new InvalidCredentialsError(
        connector.id,
        'Connector returned no credentials after successful OAuth callback'
      );
    }
    credentials = result.credentials;
    metadata = result.metadata;
  } else {
    const exchange = await exchangeCodeForToken(connector, code, flowState.codeVerifier);
    credentials = { access_token: exchange.accessToken };
    if (exchange.refreshToken) credentials.refresh_token = exchange.refreshToken;
    if (exchange.expiresAt) credentials.expires_at = exchange.expiresAt;

    const test = connector.testConnection
      ? await connector.testConnection(credentials, context)
      : { ok: true };
    if (!test.ok) {
      throw new InvalidCredentialsError(connector.id, test.error);
    }
    metadata = test.metadata;
  }

  const connectionId = await storeCredentials(connector, context, credentials, metadata);

  return {
    success: true,
    connectionId,
    metadata,
  };
}
