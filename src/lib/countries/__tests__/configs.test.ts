import { describe, expect, it } from 'vitest';
import { countries } from '@/lib/countries';

describe('country config: NL', () => {
  const nl = countries.NL;

  it('has Dutch identity fields', () => {
    expect(nl.code).toBe('NL');
    expect(nl.flagEmoji).toBe('🇳🇱');
    expect(nl.defaultCurrency).toBe('EUR');
    expect(nl.timezone).toBe('Europe/Amsterdam');
    expect(nl.defaultLocale).toBe('nl');
  });

  it('uses VAT-style tax identifier with regex matching valid samples', () => {
    expect(nl.taxIdentifier.fieldKey).toBe('vat_number');
    const re = new RegExp(nl.taxIdentifier.regex);
    expect(re.test('NL123456789B01')).toBe(true);
    expect(re.test('NL000000000B99')).toBe(true);
    expect(re.test('123456789')).toBe(false);
    expect(re.test('NL12345B01')).toBe(false);
  });

  it('configures the four expected accounting providers in priority order', () => {
    expect(nl.providers.accounting).toEqual([
      'moneybird',
      'e-boekhouden',
      'exact-online',
      'twinfield',
    ]);
  });

  it('lists payment providers including stripe and mollie', () => {
    expect(nl.providers.payments).toContain('stripe');
    expect(nl.providers.payments).toContain('mollie');
  });

  it('uses twilio as the phone provider', () => {
    expect(nl.providers.phone).toEqual(['twilio']);
  });

  it('has at least one launch-required legal requirement', () => {
    expect(nl.legalRequirements.some((r) => r.requiredAtLaunch)).toBe(true);
  });
});

describe('country config: CW', () => {
  const cw = countries.CW;

  it('has Curaçao identity fields', () => {
    expect(cw.code).toBe('CW');
    expect(cw.flagEmoji).toBe('🇨🇼');
    expect(cw.defaultCurrency).toBe('ANG');
    expect(cw.supportedCurrencies).toEqual(expect.arrayContaining(['ANG', 'USD', 'EUR']));
    expect(cw.timezone).toBe('America/Curacao');
  });

  it('uses CRIB-style tax identifier with regex matching nine digits', () => {
    expect(cw.taxIdentifier.fieldKey).toBe('crib_number');
    const re = new RegExp(cw.taxIdentifier.regex);
    expect(re.test('123456789')).toBe(true);
    expect(re.test('00000000A')).toBe(false);
    expect(re.test('12345678')).toBe(false);
    expect(re.test('1234567890')).toBe(false);
  });

  it('uses telnyx for phone (only +599 option in registry)', () => {
    expect(cw.providers.phone).toEqual(['telnyx']);
  });

  it('does not list mollie for payments (NL-only)', () => {
    expect(cw.providers.payments).not.toContain('mollie');
  });

  it('lists xero or quickbooks for accounting', () => {
    expect(cw.providers.accounting).toContain('xero');
    expect(cw.providers.accounting).toContain('quickbooks');
  });
});
