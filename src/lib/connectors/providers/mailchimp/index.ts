/**
 * Mailchimp connector — second newsletter provider, last connector
 * of phase 6/7.
 *
 * Importing this module registers the connector in the framework's
 * registry. `@/lib/connectors`'s barrel re-exports from here so any
 * code reaching for `import '@/lib/connectors'` also pulls Mailchimp in.
 */
import { registerConnector } from '../../registry';
import { MailchimpConnector, mailchimpConnector } from './connector';

registerConnector(mailchimpConnector);

export { MailchimpConnector, mailchimpConnector };
export { MailchimpClient } from './client';
export {
  MAILCHIMP_ERROR_CODES,
  configurationIncomplete,
  mailchimpNetworkError,
  mapMailchimpError,
} from './errors';
export {
  MAILCHIMP_AUTHORIZE_URL,
  MAILCHIMP_METADATA_URL,
  MAILCHIMP_TOKEN_URL,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchMetadata,
  getMailchimpOAuthConfig,
  type BuildAuthorizeUrlInput,
  type ExchangeCodeInput,
  type FetchMetadataInput,
  type MailchimpOAuthConfig,
} from './oauth';
export type {
  MailchimpAccount,
  MailchimpConnectorMetadata,
  MailchimpCredentials,
  MailchimpMetadata,
  MailchimpOAuthTokenResponse,
} from './types';
export type { MailchimpClientOptions } from './client';
