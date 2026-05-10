/**
 * Brevo connector — first newsletter / email-marketing provider.
 *
 * Importing this module registers the connector in the framework's
 * registry. `@/lib/connectors`'s barrel re-exports from here so any
 * code reaching for `import '@/lib/connectors'` also pulls Brevo in.
 */
import { registerConnector } from '../../registry';
import { BrevoConnector, brevoConnector } from './connector';

registerConnector(brevoConnector);

export { BrevoConnector, brevoConnector };
export { BrevoClient, isBrevoKey } from './client';
export { BREVO_ERROR_CODES, brevoNetworkError, mapBrevoError } from './errors';
export type { BrevoAccount, BrevoCredentials, BrevoMetadata, BrevoPlan } from './types';
export type { BrevoClientOptions } from './client';
