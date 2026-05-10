/**
 * PayPal Business connector — second OAuth payment provider.
 *
 * Importing this module registers the connector in the framework's
 * registry. `@/lib/connectors`'s barrel re-exports from here so any
 * code reaching for `import '@/lib/connectors'` also pulls PayPal in.
 */
import { registerConnector } from '../../registry';
import { PayPalConnector, paypalConnector } from './connector';

registerConnector(paypalConnector);

export { PayPalConnector, paypalConnector };
export { PayPalClient } from './client';
export {
  getPayPalApiBaseUrl,
  getPayPalAuthorizeBaseUrl,
  getPayPalEnvironment,
  type PayPalEnvironment,
} from './environment';
export {
  PAYPAL_ERROR_CODES,
  configurationIncomplete,
  mapPayPalError,
  paypalNetworkError,
} from './errors';
export {
  DEFAULT_PAYPAL_SCOPES,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getPayPalOAuthConfig,
  type BuildAuthorizeUrlInput,
  type ExchangeCodeInput,
  type PayPalOAuthConfig,
} from './oauth';
export type {
  PayPalCredentials,
  PayPalMetadata,
  PayPalOAuthTokenResponse,
  PayPalUserInfo,
} from './types';
export type { PayPalClientOptions } from './client';
