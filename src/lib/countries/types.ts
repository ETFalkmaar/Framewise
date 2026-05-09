/**
 * Country + provider configuration types.
 *
 * Adding a new country is a three-step process (see registry.ts):
 *   1. Add the ISO code to `CountryCode`.
 *   2. Add a `<code>.ts` config that exports a `CountryConfig`.
 *   3. Wire it into `countries` in `registry.ts`.
 */

export type CountryCode = 'NL' | 'CW';

export type ProviderCategory = 'accounting' | 'payments' | 'phone' | 'crm' | 'newsletter';

export type AuthMethod = 'oauth' | 'api_key';

export type SetupComplexity = 'easy' | 'medium' | 'advanced';

export type ProviderId = string;

export type SupportedLocale = 'nl' | 'fr' | 'en';

export interface LocalisedString {
  nl: string;
  fr: string;
  en: string;
}

export interface ProviderPricing {
  free?: boolean;
  startingPriceMonthlyEur?: number;
  transactionFeePercent?: number;
  notes?: LocalisedString;
}

export interface ProviderEntry {
  id: ProviderId;
  name: string;
  category: ProviderCategory;
  authMethod: AuthMethod;
  description: LocalisedString;
  websiteUrl: string;
  documentationUrl?: string;
  logoSlug: string;
  pricing: ProviderPricing;
  setupComplexity: SetupComplexity;
  recommendedFor: CountryCode[];
  availableIn: CountryCode[];
  features: string[];
  caveats?: LocalisedString;
}

export interface LegalRequirement {
  category: ProviderCategory;
  requiredAtLaunch: boolean;
  description: LocalisedString;
}

export interface CountryTaxIdentifier {
  name: string;
  fieldKey: 'vat_number' | 'crib_number';
  format: LocalisedString;
  /** RFC-style regex source (no flags), serialisable to JSON. */
  regex: string;
}

export interface CountryConfig {
  code: CountryCode;
  name: LocalisedString;
  flagEmoji: string;
  defaultLocale: SupportedLocale;
  availableLocales: SupportedLocale[];
  defaultCurrency: 'EUR' | 'USD' | 'ANG';
  supportedCurrencies: Array<'EUR' | 'USD' | 'ANG'>;
  timezone: string;
  taxIdentifier: CountryTaxIdentifier;
  providers: Record<ProviderCategory, ProviderId[]>;
  legalRequirements: LegalRequirement[];
  notes?: LocalisedString;
}
