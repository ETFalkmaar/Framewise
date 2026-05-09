/**
 * Country + provider registry.
 *
 * Application code should import from this module — never reach into
 * `./providers/*` or `./nl.ts`/`./cw.ts` directly. That keeps the surface
 * area small and lets us evolve the internal layout (split files,
 * generated bundles, ...) without breaking call sites.
 */

export type {
  AuthMethod,
  CountryCode,
  CountryConfig,
  CountryTaxIdentifier,
  LegalRequirement,
  LocalisedString,
  ProviderCategory,
  ProviderEntry,
  ProviderId,
  ProviderPricing,
  SetupComplexity,
  SupportedLocale,
} from './types';

export {
  countries,
  providerRegistry,
  getCountryConfig,
  getProviderById,
  getAllProviders,
  getProvidersByCategory,
  getProvidersForCountry,
  isProviderAvailableForCountry,
} from './registry';
