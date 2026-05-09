import type {
  CountryCode,
  CountryConfig,
  ProviderCategory,
  ProviderEntry,
  ProviderId,
} from './types';

import nl from './nl';
import cw from './cw';

import moneybird from './providers/moneybird';
import eBoekhouden from './providers/e-boekhouden';
import exactOnline from './providers/exact-online';
import twinfield from './providers/twinfield';
import xero from './providers/xero';
import quickbooks from './providers/quickbooks';
import bdoOnline from './providers/bdo-online';
import stripe from './providers/stripe';
import mollie from './providers/mollie';
import paypalBusiness from './providers/paypal-business';
import twilio from './providers/twilio';
import telnyx from './providers/telnyx';
import hubspot from './providers/hubspot';
import pipedrive from './providers/pipedrive';
import brevo from './providers/brevo';
import mailchimp from './providers/mailchimp';

/**
 * Master list of every supported country, keyed by ISO 3166-1 alpha-2 code.
 *
 * Adding a new country: create `src/lib/countries/<code>.ts`, import it here,
 * and add the corresponding `CountryCode` literal to `types.ts`.
 */
export const countries: Record<CountryCode, CountryConfig> = {
  NL: nl,
  CW: cw,
};

/**
 * Master list of every provider entry, keyed by provider id.
 *
 * Adding a new provider: create `src/lib/countries/providers/<id>.ts`, import
 * it here, and reference the id from the relevant country config(s).
 */
export const providerRegistry: Record<ProviderId, ProviderEntry> = {
  moneybird,
  'e-boekhouden': eBoekhouden,
  'exact-online': exactOnline,
  twinfield,
  xero,
  quickbooks,
  'bdo-online': bdoOnline,
  stripe,
  mollie,
  'paypal-business': paypalBusiness,
  twilio,
  telnyx,
  hubspot,
  pipedrive,
  brevo,
  mailchimp,
};

/**
 * Get a country config by ISO code, or `undefined` when the code is unknown.
 *
 * Use this in repository code, validation rules, and UI surfaces that need
 * to render country-specific copy (currency, tax id format, …).
 */
export function getCountryConfig(code: CountryCode): CountryConfig | undefined {
  return countries[code];
}

/**
 * Get a single provider entry by id, or `undefined` if the id is unknown.
 */
export function getProviderById(id: ProviderId): ProviderEntry | undefined {
  return providerRegistry[id];
}

/**
 * Returns every provider entry in the registry, sorted alphabetically by id.
 *
 * Sorting keeps debug output and snapshot tests deterministic across runs.
 */
export function getAllProviders(): ProviderEntry[] {
  return Object.values(providerRegistry).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Returns every provider in a given category, sorted alphabetically by id.
 */
export function getProvidersByCategory(category: ProviderCategory): ProviderEntry[] {
  return getAllProviders().filter((p) => p.category === category);
}

/**
 * Returns the providers configured for a country, optionally filtered by
 * category. Order matches the order in the country config (preferred first).
 *
 * Unknown ids in a country config are silently skipped — the country-config
 * tests assert that every referenced id exists in the provider registry,
 * so this should never happen at runtime.
 */
export function getProvidersForCountry(
  code: CountryCode,
  category?: ProviderCategory
): ProviderEntry[] {
  const config = countries[code];
  if (!config) return [];

  const ids = category
    ? config.providers[category]
    : (Object.values(config.providers).flat() as ProviderId[]);

  const seen = new Set<ProviderId>();
  const out: ProviderEntry[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const entry = providerRegistry[id];
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * True iff the provider exists and lists the given country in `availableIn`.
 *
 * Note: this answers the *technical* question "can this provider operate in
 * this country" — it does not check whether the country config actually
 * recommends it. Use `getProvidersForCountry()` for the curated list.
 */
export function isProviderAvailableForCountry(
  providerId: ProviderId,
  countryCode: CountryCode
): boolean {
  const entry = providerRegistry[providerId];
  if (!entry) return false;
  return entry.availableIn.includes(countryCode);
}
