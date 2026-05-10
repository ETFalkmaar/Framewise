/**
 * Moneybird connector — Dutch accounting (zzp + MKB).
 *
 * Importing this module registers the connector in the framework's
 * registry. Step 14's `@/lib/connectors` index re-exports from here so
 * any code reaching for `import '@/lib/connectors'` also pulls in
 * Moneybird (and future provider modules).
 */
import { registerConnector } from '../../registry';
import { MoneybirdConnector, moneybirdConnector } from './connector';

registerConnector(moneybirdConnector);

export { MoneybirdConnector, moneybirdConnector };
export { MoneybirdClient } from './client';
export { MONEYBIRD_ERROR_CODES, mapMoneybirdError, networkError } from './errors';
export type { MoneybirdAdministration, MoneybirdCredentials, MoneybirdMetadata } from './types';
export type { MoneybirdClientOptions } from './client';
