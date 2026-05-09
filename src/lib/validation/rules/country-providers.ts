import {
  getCountryConfig,
  getProviderById,
  isProviderAvailableForCountry,
  type CountryCode,
  type ProviderId,
} from '@/lib/countries';

import { ValidationError, VALIDATION_ERROR_CODES } from '../errors';

/**
 * True iff `providerId` exists in the registry and lists `countryCode` in
 * its `availableIn` set. Falsy answer covers both "unknown provider" and
 * "provider exists but is not available in this country".
 *
 * Re-exported from `@/lib/countries` for convenience so call sites that
 * already import from `@/lib/validation` don't have to pull in a second
 * module.
 */
export function isProviderAvailable(providerId: ProviderId, countryCode: CountryCode): boolean {
  return isProviderAvailableForCountry(providerId, countryCode);
}

/**
 * Throws a `ValidationError` (`PROVIDER_NOT_AVAILABLE_IN_COUNTRY`) when the
 * provider/country combination is not allowed. Use this at the boundary of
 * any repository action that wires a tenant to a third-party connection.
 *
 * Errors distinguish three cases:
 *   - country code not recognised at all
 *   - provider id not in the registry
 *   - provider exists but is not available for that country
 */
export function assertProviderAvailable(providerId: ProviderId, countryCode: CountryCode): void {
  if (!getCountryConfig(countryCode)) {
    throw new ValidationError(
      VALIDATION_ERROR_CODES.PROVIDER_NOT_AVAILABLE_IN_COUNTRY,
      `Country "${countryCode}" is not supported`,
      { field: 'country_code' }
    );
  }

  const provider = getProviderById(providerId);
  if (!provider) {
    throw new ValidationError(
      VALIDATION_ERROR_CODES.PROVIDER_NOT_AVAILABLE_IN_COUNTRY,
      `Provider "${providerId}" is not registered`,
      { field: 'provider_id' }
    );
  }

  if (!provider.availableIn.includes(countryCode)) {
    throw new ValidationError(
      VALIDATION_ERROR_CODES.PROVIDER_NOT_AVAILABLE_IN_COUNTRY,
      `Provider "${providerId}" is not available in country "${countryCode}"`,
      { field: 'provider_id' }
    );
  }
}
