/**
 * Mollie connector — first payment provider.
 *
 * Importing this module registers the connector in the framework's
 * registry. `@/lib/connectors`'s barrel re-exports from here so any
 * code reaching for `import '@/lib/connectors'` also pulls Mollie in.
 */
import { registerConnector } from '../../registry';
import { MollieConnector, mollieConnector } from './connector';

registerConnector(mollieConnector);

export { MollieConnector, mollieConnector };
export { MollieClient, isMollieKey } from './client';
export { MOLLIE_ERROR_CODES, mapMollieError, mollieNetworkError } from './errors';
export type {
  MollieCredentials,
  MollieKeyType,
  MollieMetadata,
  MollieOrganization,
  MolliePaymentMethod,
} from './types';
export type { MollieClientOptions } from './client';
