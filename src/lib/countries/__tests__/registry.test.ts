import { describe, expect, it } from 'vitest';
import {
  countries,
  getAllProviders,
  getCountryConfig,
  getProviderById,
  getProvidersByCategory,
  getProvidersForCountry,
  isProviderAvailableForCountry,
  providerRegistry,
  type CountryCode,
  type ProviderCategory,
} from '@/lib/countries';

describe('countries registry', () => {
  it('has exactly the expected country codes', () => {
    expect(Object.keys(countries).sort()).toEqual(['CW', 'NL']);
  });

  it('getCountryConfig returns the same instance as countries[code]', () => {
    expect(getCountryConfig('NL')).toBe(countries.NL);
    expect(getCountryConfig('CW')).toBe(countries.CW);
  });

  it('getCountryConfig returns undefined for unknown codes', () => {
    expect(getCountryConfig('XX' as CountryCode)).toBeUndefined();
  });
});

describe('providerRegistry', () => {
  it('contains all 16 expected provider ids', () => {
    const ids = Object.keys(providerRegistry).sort();
    expect(ids).toEqual(
      [
        'bdo-online',
        'brevo',
        'e-boekhouden',
        'exact-online',
        'hubspot',
        'mailchimp',
        'mollie',
        'moneybird',
        'paypal-business',
        'pipedrive',
        'quickbooks',
        'stripe',
        'telnyx',
        'twilio',
        'twinfield',
        'xero',
      ].sort()
    );
  });

  it("every entry's id matches its registry key", () => {
    for (const [key, entry] of Object.entries(providerRegistry)) {
      expect(entry.id).toBe(key);
    }
  });

  it('every entry references valid CountryCode values in availableIn / recommendedFor', () => {
    const knownCountries = new Set(Object.keys(countries));
    for (const entry of Object.values(providerRegistry)) {
      for (const c of entry.availableIn) expect(knownCountries.has(c)).toBe(true);
      for (const c of entry.recommendedFor) expect(knownCountries.has(c)).toBe(true);
      expect(entry.recommendedFor.every((c) => entry.availableIn.includes(c))).toBe(true);
    }
  });

  it('getAllProviders returns deterministic alphabetical order', () => {
    const ids = getAllProviders().map((p) => p.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('getProviderById returns the entry or undefined', () => {
    expect(getProviderById('mollie')?.name).toBe('Mollie');
    expect(getProviderById('does-not-exist')).toBeUndefined();
  });

  it('getProvidersByCategory groups correctly', () => {
    const accounting = getProvidersByCategory('accounting').map((p) => p.id);
    expect(accounting).toContain('moneybird');
    expect(accounting).toContain('xero');
    expect(accounting).not.toContain('mollie');

    const newsletter = getProvidersByCategory('newsletter').map((p) => p.id);
    expect(newsletter.sort()).toEqual(['brevo', 'mailchimp']);
  });
});

describe('country provider lists', () => {
  const categories: ProviderCategory[] = ['accounting', 'payments', 'phone', 'crm', 'newsletter'];

  it("every id in a country's providers exists in the registry", () => {
    for (const country of Object.values(countries)) {
      for (const cat of categories) {
        const ids = country.providers[cat] ?? [];
        for (const id of ids) {
          expect(providerRegistry[id], `${country.code}/${cat}/${id}`).toBeDefined();
        }
      }
    }
  });

  it('every referenced provider lists the country in its availableIn', () => {
    for (const country of Object.values(countries)) {
      for (const cat of categories) {
        const ids = country.providers[cat] ?? [];
        for (const id of ids) {
          const entry = providerRegistry[id]!;
          expect(
            entry.availableIn.includes(country.code),
            `${id} should list ${country.code} in availableIn`
          ).toBe(true);
        }
      }
    }
  });

  it('getProvidersForCountry without category returns the union, deduplicated', () => {
    const nlAll = getProvidersForCountry('NL').map((p) => p.id);
    expect(nlAll).toContain('moneybird');
    expect(nlAll).toContain('mollie');
    expect(nlAll).toContain('twilio');
    expect(nlAll).toContain('hubspot');
    expect(nlAll).toContain('brevo');
    expect(new Set(nlAll).size).toBe(nlAll.length);
  });

  it('getProvidersForCountry with category respects config order', () => {
    const accountingNL = getProvidersForCountry('NL', 'accounting').map((p) => p.id);
    expect(accountingNL[0]).toBe('moneybird');
    expect(accountingNL).toEqual(['moneybird', 'e-boekhouden', 'exact-online', 'twinfield']);
  });

  it('getProvidersForCountry returns [] for unknown country code', () => {
    expect(getProvidersForCountry('XX' as CountryCode)).toEqual([]);
  });
});

describe('isProviderAvailableForCountry', () => {
  it('returns true when provider lists the country', () => {
    expect(isProviderAvailableForCountry('stripe', 'NL')).toBe(true);
    expect(isProviderAvailableForCountry('stripe', 'CW')).toBe(true);
    expect(isProviderAvailableForCountry('telnyx', 'CW')).toBe(true);
  });

  it('returns false when provider does not list the country', () => {
    expect(isProviderAvailableForCountry('moneybird', 'CW')).toBe(false);
    expect(isProviderAvailableForCountry('telnyx', 'NL')).toBe(false);
    expect(isProviderAvailableForCountry('mollie', 'CW')).toBe(false);
  });

  it('returns false for unknown provider id', () => {
    expect(isProviderAvailableForCountry('nope', 'NL')).toBe(false);
  });
});
