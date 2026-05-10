/**
 * e-Boekhouden connector — second NL accounting provider.
 *
 * Importing this module registers the connector in the framework's
 * registry. `@/lib/connectors`'s barrel re-exports from here so any
 * code reaching for `import '@/lib/connectors'` also pulls e-Boekhouden
 * in.
 */
import { registerConnector } from '../../registry';
import { EBoekhoudenConnector, eBoekhoudenConnector } from './connector';

registerConnector(eBoekhoudenConnector);

export { EBoekhoudenConnector, eBoekhoudenConnector };
export { EBoekhoudenClient } from './client';
export {
  EBOEKHOUDEN_ERROR_CODES,
  configurationIncomplete,
  mapEBoekhoudenError,
  networkError,
} from './errors';
export {
  __peekCachedSession,
  __resetSessionCache,
  getCachedSession,
  invalidateCachedSession,
  setCachedSession,
} from './session-cache';
export type {
  EBoekhoudenAdministration,
  EBoekhoudenCredentials,
  EBoekhoudenMetadata,
  EBoekhoudenSessionResponse,
} from './types';
export type { EBoekhoudenClientOptions } from './client';
