import { describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { PayPalClient } from '@/lib/connectors/providers/paypal/client';
import { PAYPAL_ERROR_CODES } from '@/lib/connectors/providers/paypal/errors';
import type { PayPalUserInfo } from '@/lib/connectors/providers/paypal/types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_USER: PayPalUserInfo = {
  user_id: 'https://www.paypal.com/webapps/auth/identity/user/abc123',
  name: 'Demo Restaurant Amsterdam B.V.',
  email: 'owner@demo-restaurant.example',
  email_verified: true,
  payer_id: 'PAYER123ABC',
  verified_account: true,
  zoneinfo: 'Europe/Amsterdam',
  locale: 'nl_NL',
  address: { country: 'Netherlands', country_code: 'NL' },
};

describe('PayPalClient constructor', () => {
  it('throws when accessToken is empty', () => {
    expect(() => new PayPalClient({ accessToken: '', environment: 'sandbox' })).toThrow(
      /accessToken is required/
    );
  });

  it('accepts valid options for sandbox', () => {
    expect(
      () => new PayPalClient({ accessToken: 'A21_test', environment: 'sandbox' })
    ).not.toThrow();
  });

  it('accepts valid options for live', () => {
    expect(() => new PayPalClient({ accessToken: 'A21_live', environment: 'live' })).not.toThrow();
  });
});

describe('PayPalClient.getUserInfo', () => {
  it('returns parsed PayPalUserInfo on 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_USER));
    const client = new PayPalClient({
      accessToken: 'A21_test',
      environment: 'sandbox',
      fetchImpl,
    });
    const info = await client.getUserInfo();
    expect(info.user_id).toBe(SAMPLE_USER.user_id);
    expect(info.email).toBe('owner@demo-restaurant.example');
    expect(info.address?.country_code).toBe('NL');
  });

  it('hits the sandbox base URL with schema query param', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_USER));
    const client = new PayPalClient({
      accessToken: 'A21_test',
      environment: 'sandbox',
      fetchImpl,
    });
    await client.getUserInfo();
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'https://api-m.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1'
    );
  });

  it('hits the live base URL when environment=live', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_USER));
    const client = new PayPalClient({ accessToken: 'A21_live', environment: 'live', fetchImpl });
    await client.getUserInfo();
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'https://api-m.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1'
    );
  });

  it('sends Authorization + User-Agent + Accept headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_USER));
    const client = new PayPalClient({
      accessToken: 'A21_test',
      environment: 'sandbox',
      fetchImpl,
    });
    await client.getUserInfo();
    const headers = fetchImpl.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer A21_test');
    expect(headers['User-Agent']).toMatch(/Framewise/);
    expect(headers.Accept).toBe('application/json');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { error: 'invalid_token', error_description: 'Token expired' })
      );
    const client = new PayPalClient({ accessToken: 'A21_bad', environment: 'sandbox', fetchImpl });
    await expect(client.getUserInfo()).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws RATE_LIMITED ConnectorError on 429', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { name: 'RATE_LIMIT_REACHED', message: 'Too many requests' })
      );
    const client = new PayPalClient({ accessToken: 'A21_test', environment: 'sandbox', fetchImpl });
    await expect(client.getUserInfo()).rejects.toMatchObject({
      code: PAYPAL_ERROR_CODES.RATE_LIMITED,
    });
  });

  it('honours custom baseUrl override', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_USER));
    const client = new PayPalClient({
      accessToken: 'A21_test',
      environment: 'sandbox',
      baseUrl: 'https://paypal.mock.test',
      fetchImpl,
    });
    await client.getUserInfo();
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'https://paypal.mock.test/v1/identity/oauth2/userinfo?schema=paypalv1.1'
    );
  });

  it('wraps AbortError as NETWORK_ERROR via paypalNetworkError', async () => {
    const fetchImpl = vi.fn().mockImplementationOnce(async () => {
      const e = new Error('aborted');
      (e as { name?: string }).name = 'AbortError';
      throw e;
    });
    const client = new PayPalClient({
      accessToken: 'A21_test',
      environment: 'sandbox',
      fetchImpl,
      timeoutMs: 50,
    });
    await expect(client.getUserInfo()).rejects.toMatchObject({
      code: PAYPAL_ERROR_CODES.NETWORK_ERROR,
    });
  });

  it('does not retry on 5xx (caller decides)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { name: 'INTERNAL_ERROR', message: 'oops' }));
    const client = new PayPalClient({ accessToken: 'A21_test', environment: 'sandbox', fetchImpl });
    await expect(client.getUserInfo()).rejects.toBeInstanceOf(ConnectorError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('exposes the active environment via getEnvironment()', () => {
    const sandbox = new PayPalClient({ accessToken: 'A21_test', environment: 'sandbox' });
    const live = new PayPalClient({ accessToken: 'A21_live', environment: 'live' });
    expect(sandbox.getEnvironment()).toBe('sandbox');
    expect(live.getEnvironment()).toBe('live');
  });
});
