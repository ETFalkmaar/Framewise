/**
 * HubSpot CRM connector — first CRM provider.
 *
 * Importing this module registers the connector in the framework's
 * registry. `@/lib/connectors`'s barrel re-exports from here so any
 * code reaching for `import '@/lib/connectors'` also pulls HubSpot in.
 */
import { registerConnector } from '../../registry';
import { HubSpotConnector, hubspotConnector } from './connector';

registerConnector(hubspotConnector);

export { HubSpotConnector, hubspotConnector };
export { HubSpotClient } from './client';
export {
  HUBSPOT_ERROR_CODES,
  configurationIncomplete,
  hubspotNetworkError,
  mapHubSpotError,
} from './errors';
export {
  DEFAULT_HUBSPOT_SCOPES,
  HUBSPOT_AUTHORIZE_URL,
  HUBSPOT_TOKEN_URL,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getHubSpotOAuthConfig,
  type BuildAuthorizeUrlInput,
  type ExchangeCodeInput,
  type HubSpotOAuthConfig,
} from './oauth';
export type {
  HubSpotAccountInfo,
  HubSpotCredentials,
  HubSpotMetadata,
  HubSpotOAuthTokenResponse,
} from './types';
export type { HubSpotClientOptions } from './client';
