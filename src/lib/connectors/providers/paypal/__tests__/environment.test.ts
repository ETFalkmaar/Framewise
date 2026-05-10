import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getPayPalApiBaseUrl,
  getPayPalAuthorizeBaseUrl,
  getPayPalEnvironment,
} from '@/lib/connectors/providers/paypal/environment';

describe('getPayPalEnvironment', () => {
  const original = process.env.PAYPAL_ENVIRONMENT;

  beforeEach(() => {
    delete process.env.PAYPAL_ENVIRONMENT;
  });
  afterEach(() => {
    process.env.PAYPAL_ENVIRONMENT = original;
  });

  it('defaults to sandbox when env var missing', () => {
    expect(getPayPalEnvironment()).toBe('sandbox');
  });

  it('returns live only when env var is exactly "live" (case-insensitive)', () => {
    process.env.PAYPAL_ENVIRONMENT = 'live';
    expect(getPayPalEnvironment()).toBe('live');
    process.env.PAYPAL_ENVIRONMENT = 'LIVE';
    expect(getPayPalEnvironment()).toBe('live');
    process.env.PAYPAL_ENVIRONMENT = '  Live  ';
    expect(getPayPalEnvironment()).toBe('live');
  });

  it('falls through to sandbox for any other value', () => {
    process.env.PAYPAL_ENVIRONMENT = 'production';
    expect(getPayPalEnvironment()).toBe('sandbox');
    process.env.PAYPAL_ENVIRONMENT = '';
    expect(getPayPalEnvironment()).toBe('sandbox');
    process.env.PAYPAL_ENVIRONMENT = 'sandbox';
    expect(getPayPalEnvironment()).toBe('sandbox');
  });
});

describe('getPayPalAuthorizeBaseUrl', () => {
  it('returns the sandbox URL for sandbox', () => {
    expect(getPayPalAuthorizeBaseUrl('sandbox')).toBe('https://www.sandbox.paypal.com/connect');
  });
  it('returns the live URL for live', () => {
    expect(getPayPalAuthorizeBaseUrl('live')).toBe('https://www.paypal.com/connect');
  });
});

describe('getPayPalApiBaseUrl', () => {
  it('returns the sandbox API URL for sandbox', () => {
    expect(getPayPalApiBaseUrl('sandbox')).toBe('https://api-m.sandbox.paypal.com');
  });
  it('returns the live API URL for live', () => {
    expect(getPayPalApiBaseUrl('live')).toBe('https://api-m.paypal.com');
  });
});
