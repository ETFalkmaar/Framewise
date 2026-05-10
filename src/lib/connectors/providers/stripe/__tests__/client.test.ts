import { describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { StripeClient, isStripeAccountId } from '@/lib/connectors/providers/stripe/client';
import { STRIPE_ERROR_CODES } from '@/lib/connectors/providers/stripe/errors';
import type { StripeAccount } from '@/lib/connectors/providers/stripe/types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_ACCOUNT: StripeAccount = {
  id: 'acct_1ABC',
  business_profile: {
    name: 'Demo Restaurant Amsterdam B.V.',
    url: 'https://demo-restaurant.example',
    support_email: 'support@demo-restaurant.example',
  },
  country: 'NL',
  default_currency: 'eur',
  email: 'owner@demo-restaurant.example',
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
};

describe('StripeClient constructor', () => {
  it('throws when accessToken is empty', () => {
    expect(() => new StripeClient({ accessToken: '' })).toThrow(/accessToken is required/);
  });

  it('accepts valid options', () => {
    expect(() => new StripeClient({ accessToken: 'sk_test_xyz' })).not.toThrow();
  });
});

describe('StripeClient.getAccount', () => {
  it('returns parsed StripeAccount on 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new StripeClient({ accessToken: 'sk_test_xyz', fetchImpl });
    const account = await client.getAccount();
    expect(account.id).toBe('acct_1ABC');
    expect(account.country).toBe('NL');
    expect(account.charges_enabled).toBe(true);
  });

  it('hits /account when no id supplied', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new StripeClient({ accessToken: 'sk_test_xyz', fetchImpl });
    await client.getAccount();
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.stripe.com/v1/account');
  });

  it('hits /accounts/{id} when id supplied', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new StripeClient({ accessToken: 'sk_test_xyz', fetchImpl });
    await client.getAccount('acct_1ABC');
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.stripe.com/v1/accounts/acct_1ABC');
  });

  it('sends Authorization, Stripe-Version, and User-Agent headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new StripeClient({ accessToken: 'sk_test_xyz', fetchImpl });
    await client.getAccount();
    const headers = fetchImpl.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk_test_xyz');
    expect(headers['Stripe-Version']).toBe('2024-06-20');
    expect(headers['User-Agent']).toMatch(/Framewise/);
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { type: 'invalid_request_error', message: 'Invalid API Key' } })
      );
    const client = new StripeClient({ accessToken: 'sk_bad', fetchImpl });
    await expect(client.getAccount()).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws RATE_LIMITED ConnectorError on 429', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: 'Too many requests' } }));
    const client = new StripeClient({ accessToken: 'sk_test_xyz', fetchImpl });
    await expect(client.getAccount()).rejects.toMatchObject({
      code: STRIPE_ERROR_CODES.RATE_LIMITED,
    });
  });

  it('honours custom baseUrl override', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new StripeClient({
      accessToken: 'sk_test_xyz',
      baseUrl: 'https://stripe.mock.test/v1',
      fetchImpl,
    });
    await client.getAccount();
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://stripe.mock.test/v1/account');
  });

  it('wraps AbortError as NETWORK_ERROR via stripeNetworkError', async () => {
    const fetchImpl = vi.fn().mockImplementationOnce(async () => {
      const e = new Error('aborted');
      (e as { name?: string }).name = 'AbortError';
      throw e;
    });
    const client = new StripeClient({ accessToken: 'sk_test_xyz', fetchImpl, timeoutMs: 50 });
    await expect(client.getAccount()).rejects.toMatchObject({
      code: STRIPE_ERROR_CODES.NETWORK_ERROR,
    });
  });

  it('maps unknown 4xx to ConnectorError (not Invalid)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(404, { error: { message: 'No such account' } }));
    const client = new StripeClient({ accessToken: 'sk_test_xyz', fetchImpl });
    await expect(client.getAccount()).rejects.toMatchObject({
      code: STRIPE_ERROR_CODES.RESOURCE_NOT_FOUND,
    });
  });

  it('does not retry on 5xx (caller decides)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: { message: 'oops' } }));
    const client = new StripeClient({ accessToken: 'sk_test_xyz', fetchImpl });
    await expect(client.getAccount()).rejects.toBeInstanceOf(ConnectorError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('isStripeAccountId', () => {
  it('accepts well-formed acct_ ids', () => {
    expect(isStripeAccountId('acct_1ABCDEF1234567')).toBe(true);
  });

  it('rejects non-acct prefixes', () => {
    expect(isStripeAccountId('cus_123ABCDEF')).toBe(false);
    expect(isStripeAccountId('sk_test_xyz')).toBe(false);
  });

  it('rejects too-short ids', () => {
    expect(isStripeAccountId('acct_123')).toBe(false);
  });
});
