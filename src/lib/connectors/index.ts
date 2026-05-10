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
