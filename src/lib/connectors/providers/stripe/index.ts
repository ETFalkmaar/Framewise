/**
 * Stripe Connect connector — first OAuth provider.
 *
 * Importing this module registers the connector in the framework's
 * registry. `@/lib/connectors`'s barrel re-exports from here so any
 * code reaching for `import '@/lib/connectors'` also pulls Stripe in.
 */
import { registerConnector } from '../../registry';
import { StripeConnector, stripeConnector } from './connector';

registerConnector(stripeConnector);

export { StripeConnector, stripeConnector };
export { StripeClient, isStripeAccountId } from './client';
export {
  STRIPE_ERROR_CODES,
  configurationIncomplete,
  mapStripeError,
  stripeNetworkError,
} from './errors';
export {
  STRIPE_AUTHORIZE_URL,
  STRIPE_TOKEN_URL,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getStripeOAuthConfig,
  type BuildAuthorizeUrlInput,
  type ExchangeCodeInput,
  type StripeOAuthConfig,
} from './oauth';
export type {
  StripeAccount,
  StripeCredentials,
  StripeMetadata,
  StripeOAuthTokenResponse,
} from './types';
export type { StripeClientOptions } from './client';
