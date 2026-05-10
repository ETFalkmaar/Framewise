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
