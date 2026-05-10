/**
 * Connector framework.
 *
 * One uniform shape for every third-party integration. Application
 * code talks to:
 *
 *   - `getConnector(id)` / `getConnectorsForCountry(...)` for lookup
 *   - `initiateOAuthFlow` / `handleOAuthCallback` for OAuth providers
 *   - `submitApiKeyCredentials` for API-key providers
 *   - `revokeCredentials` to disconnect
 *
 * Provider-specific implementations are plain `ConnectorDefinition`
 * literals registered via `registerConnector(...)` at module load.
 * Step 14 ships the framework + two mock connectors; steps 15–23
 * fill in the real first six connectors.
 *
 * Importing this module also imports `./test-doubles`, which
 * registers the two mock connectors. They are filtered out of
 * production UI by their `developmentOnly: true` flag.
 */

export {
  CONNECTOR_ERROR_CODES,
  ConnectorError,
  FlowAbortedError,
  InvalidCredentialsError,
  MissingFieldError,
  ProviderNotFoundError,
  StateValidationError,
  UnsupportedFlowError,
  type ConnectorErrorCode,
} from './errors';

export type {
  ApiKeyField,
  ConnectorContext,
  ConnectorDefinition,
  FlowResult,
  FlowState,
  RefreshAccessResult,
  TestConnectionResult,
} from './types';

export { BaseConnector, revokeCredentials, storeCredentials } from './base';

export {
  __resetConnectorRegistry,
  getAllConnectors,
  getConnector,
  getConnectorsByCategory,
  getConnectorsForCountry,
  registerConnector,
} from './registry';

export {
  initiateOAuthFlow,
  handleOAuthCallback,
  type HandleOAuthCallbackInput,
  type InitiateOAuthInput,
  type InitiateOAuthResult,
} from './flows/oauth';

export { submitApiKeyCredentials, type SubmitApiKeyInput } from './flows/api-key';

export {
  FLOW_STATE_TTL_MS,
  OAUTH_FLOW_COOKIE,
  generatePkcePair,
  generateState,
  packFlowState,
  unpackFlowState,
} from './flows/shared';

export { mockApiKeyConnector, mockOAuthConnector } from './test-doubles';

// ──────────────────────────────────────────────────────────────────
// Real provider connectors. Each module registers itself in the
// connector registry on import — keep these as side-effect imports.
// Step 15 ships Moneybird; steps 16–23 add the next five.
// ──────────────────────────────────────────────────────────────────
// Moneybird (step 15) — both modules export a `networkError` helper, so
// the barrel re-exports each provider's helper under a provider-prefixed
// alias to avoid a name collision.
export {
  moneybirdConnector,
  MoneybirdConnector,
  MoneybirdClient,
  MONEYBIRD_ERROR_CODES,
  mapMoneybirdError,
  networkError as moneybirdNetworkError,
} from './providers/moneybird';
export type {
  MoneybirdAdministration,
  MoneybirdCredentials,
  MoneybirdMetadata,
  MoneybirdClientOptions,
} from './providers/moneybird';

// e-Boekhouden (step 16) — REST API with two-token (User + Source) flow
// and a 55-minute session cache.
export {
  eBoekhoudenConnector,
  EBoekhoudenConnector,
  EBoekhoudenClient,
  EBOEKHOUDEN_ERROR_CODES,
  configurationIncomplete,
  mapEBoekhoudenError,
  networkError as eBoekhoudenNetworkError,
  __resetSessionCache as __resetEBoekhoudenSessionCache,
  __peekCachedSession as __peekEBoekhoudenSession,
  getCachedSession as getEBoekhoudenCachedSession,
  invalidateCachedSession as invalidateEBoekhoudenCachedSession,
  setCachedSession as setEBoekhoudenCachedSession,
} from './providers/e-boekhouden';
export type {
  EBoekhoudenAdministration,
  EBoekhoudenCredentials,
  EBoekhoudenMetadata,
  EBoekhoudenSessionResponse,
  EBoekhoudenClientOptions,
} from './providers/e-boekhouden';

// Mollie (step 17) — first payment provider. API-key flow with
// test/live key detection.
export {
  mollieConnector,
  MollieConnector,
  MollieClient,
  isMollieKey,
  MOLLIE_ERROR_CODES,
  mapMollieError,
  mollieNetworkError,
} from './providers/mollie';
export type {
  MollieCredentials,
  MollieKeyType,
  MollieMetadata,
  MollieOrganization,
  MolliePaymentMethod,
  MollieClientOptions,
} from './providers/mollie';

// Stripe Connect (step 18) — first OAuth connector. Standard accounts:
// the customer keeps a full Stripe Dashboard, money lands on their own
// bank, fees are theirs. Framewise just holds a `read_write` access token.
// Both `networkError` and `configurationIncomplete` exist on multiple
// providers — re-export under provider-prefixed aliases.
export {
  stripeConnector,
  StripeConnector,
  StripeClient,
  isStripeAccountId,
  STRIPE_ERROR_CODES,
  STRIPE_AUTHORIZE_URL,
  STRIPE_TOKEN_URL,
  buildAuthorizeUrl as buildStripeAuthorizeUrl,
  exchangeCodeForToken as exchangeStripeCodeForToken,
  getStripeOAuthConfig,
  configurationIncomplete as stripeConfigurationIncomplete,
  mapStripeError,
  stripeNetworkError,
} from './providers/stripe';
export type {
  StripeAccount,
  StripeCredentials,
  StripeMetadata,
  StripeOAuthTokenResponse,
  StripeClientOptions,
  StripeOAuthConfig,
} from './providers/stripe';

// PayPal Business (step 19) — second OAuth payment connector. Built
// for the CW route (Stripe isn't officially available for Curaçao
// entities; PayPal works directly). Sandbox + Live environments
// resolve from `PAYPAL_ENVIRONMENT`. `networkError`,
// `configurationIncomplete`, `buildAuthorizeUrl`, `exchangeCodeForToken`,
// and `mapXError` collide with Stripe — re-export under prefixed aliases.
export {
  paypalConnector,
  PayPalConnector,
  PayPalClient,
  PAYPAL_ERROR_CODES,
  DEFAULT_PAYPAL_SCOPES,
  getPayPalApiBaseUrl,
  getPayPalAuthorizeBaseUrl,
  getPayPalEnvironment,
  buildAuthorizeUrl as buildPayPalAuthorizeUrl,
  exchangeCodeForToken as exchangePayPalCodeForToken,
  getPayPalOAuthConfig,
  configurationIncomplete as paypalConfigurationIncomplete,
  mapPayPalError,
  paypalNetworkError,
} from './providers/paypal';
export type {
  PayPalCredentials,
  PayPalEnvironment,
  PayPalMetadata,
  PayPalOAuthTokenResponse,
  PayPalUserInfo,
  PayPalClientOptions,
  PayPalOAuthConfig,
} from './providers/paypal';

// HubSpot CRM (step 20) — first CRM connector. Internationally
// available (NL + CW). Free tier is plenty for the AI agent's
// lead-sync flow that lands in step 21+. No test/live mode — the
// connection card just shows the Hub identifier.
export {
  hubspotConnector,
  HubSpotConnector,
  HubSpotClient,
  HUBSPOT_ERROR_CODES,
  HUBSPOT_AUTHORIZE_URL,
  HUBSPOT_TOKEN_URL,
  DEFAULT_HUBSPOT_SCOPES,
  buildAuthorizeUrl as buildHubSpotAuthorizeUrl,
  exchangeCodeForToken as exchangeHubSpotCodeForToken,
  getHubSpotOAuthConfig,
  configurationIncomplete as hubspotConfigurationIncomplete,
  mapHubSpotError,
  hubspotNetworkError,
} from './providers/hubspot';
export type {
  HubSpotAccountInfo,
  HubSpotCredentials,
  HubSpotMetadata,
  HubSpotOAuthTokenResponse,
  HubSpotClientOptions,
  HubSpotOAuthConfig,
} from './providers/hubspot';
