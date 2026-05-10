/**
 * Pipedrive CRM connector — second CRM provider, sales-focused.
 *
 * Importing this module registers the connector in the framework's
 * registry. `@/lib/connectors`'s barrel re-exports from here so any
 * code reaching for `import '@/lib/connectors'` also pulls Pipedrive in.
 */
import { registerConnector } from '../../registry';
import { PipedriveConnector, pipedriveConnector } from './connector';

registerConnector(pipedriveConnector);

export { PipedriveConnector, pipedriveConnector };
export { PipedriveClient } from './client';
export {
  PIPEDRIVE_ERROR_CODES,
  configurationIncomplete,
  mapPipedriveError,
  pipedriveNetworkError,
} from './errors';
export {
  DEFAULT_PIPEDRIVE_SCOPES,
  PIPEDRIVE_AUTHORIZE_URL,
  PIPEDRIVE_TOKEN_URL,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getPipedriveOAuthConfig,
  type BuildAuthorizeUrlInput,
  type ExchangeCodeInput,
  type PipedriveOAuthConfig,
} from './oauth';
export type {
  PipedriveCredentials,
  PipedriveEnvelope,
  PipedriveMetadata,
  PipedriveOAuthTokenResponse,
  PipedriveUser,
} from './types';
export type { PipedriveClientOptions } from './client';
