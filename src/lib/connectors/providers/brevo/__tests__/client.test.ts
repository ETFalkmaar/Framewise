import { describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { BrevoClient, isBrevoKey } from '@/lib/connectors/providers/brevo/client';
import { BREVO_ERROR_CODES } from '@/lib/connectors/providers/brevo/errors';
import type { BrevoAccount } from '@/lib/connectors/providers/brevo/types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_ACCOUNT: BrevoAccount = {
  email: 'owner@demo-restaurant.example',
  firstName: 'Demo',
  lastName: 'Owner',
  companyName: 'Demo Restaurant Amsterdam B.V.',
  address: { street: '123 Main', city: 'Amsterdam', zipCode: '1011AA', country: 'NL' },
  plan: [{ type: 'free', creditsType: 'sendLimit', credits: 9000, userLimit: 1 }],
};

describe('BrevoClient constructor', () => {
  it('throws when apiKey is empty', () => {
    expect(() => new BrevoClient({ apiKey: '' })).toThrow(/apiKey is required/);
  });

  it('accepts valid options', () => {
    expect(() => new BrevoClient({ apiKey: 'xkeysib-deadbeef-foo' })).not.toThrow();
  });
});

describe('BrevoClient.getAccount', () => {
  it('returns parsed BrevoAccount on 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new BrevoClient({ apiKey: 'xkeysib-deadbeef-foo', fetchImpl });
    const account = await client.getAccount();
    expect(account.email).toBe('owner@demo-restaurant.example');
    expect(account.companyName).toBe('Demo Restaurant Amsterdam B.V.');
    expect(account.plan?.[0]?.type).toBe('free');
  });

  it('hits the v3 /account endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new BrevoClient({ apiKey: 'xkeysib-deadbeef-foo', fetchImpl });
    await client.getAccount();
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.brevo.com/v3/account');
  });

  it('uses CUSTOM api-key header (NOT Authorization: Bearer)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new BrevoClient({ apiKey: 'xkeysib-deadbeef-foo', fetchImpl });
    await client.getAccount();
    const headers = fetchImpl.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers['api-key']).toBe('xkeysib-deadbeef-foo');
    // Brevo's most common pitfall — assert no Bearer auth.
    expect(headers.Authorization).toBeUndefined();
  });

  it('sends User-Agent + Accept headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new BrevoClient({ apiKey: 'xkeysib-deadbeef-foo', fetchImpl });
    await client.getAccount();
    const headers = fetchImpl.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/Framewise/);
    expect(headers.Accept).toBe('application/json');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: 'unauthorized', message: 'Key not found' }));
    const client = new BrevoClient({ apiKey: 'xkeysib-bad', fetchImpl });
    await expect(client.getAccount()).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws RATE_LIMITED ConnectorError on 429', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { code: 'rate_limit_exceeded', message: 'Too many calls' })
      );
    const client = new BrevoClient({ apiKey: 'xkeysib-deadbeef-foo', fetchImpl });
    await expect(client.getAccount()).rejects.toMatchObject({
      code: BREVO_ERROR_CODES.RATE_LIMITED,
    });
  });

  it('honours custom baseUrl override', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new BrevoClient({
      apiKey: 'xkeysib-deadbeef-foo',
      baseUrl: 'https://brevo.mock.test/v3',
      fetchImpl,
    });
    await client.getAccount();
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://brevo.mock.test/v3/account');
  });

  it('wraps AbortError as NETWORK_ERROR via brevoNetworkError', async () => {
    const fetchImpl = vi.fn().mockImplementationOnce(async () => {
      const e = new Error('aborted');
      (e as { name?: string }).name = 'AbortError';
      throw e;
    });
    const client = new BrevoClient({
      apiKey: 'xkeysib-deadbeef-foo',
      fetchImpl,
      timeoutMs: 50,
    });
    await expect(client.getAccount()).rejects.toMatchObject({
      code: BREVO_ERROR_CODES.NETWORK_ERROR,
    });
  });

  it('does not retry on 5xx (caller decides)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'internal_error', message: 'oops' }));
    const client = new BrevoClient({ apiKey: 'xkeysib-deadbeef-foo', fetchImpl });
    await expect(client.getAccount()).rejects.toBeInstanceOf(ConnectorError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('isBrevoKey', () => {
  it('accepts well-formed xkeysib- keys', () => {
    expect(isBrevoKey('xkeysib-deadbeef0123456789abcdef-someAlphaNum123')).toBe(true);
  });

  it('rejects keys without xkeysib- prefix', () => {
    expect(isBrevoKey('sk_test_abc123')).toBe(false);
    expect(isBrevoKey('abc-deadbeef-foo')).toBe(false);
  });

  it('rejects keys without the second segment', () => {
    expect(isBrevoKey('xkeysib-deadbeef')).toBe(false);
  });

  it('rejects keys with non-hex first segment', () => {
    expect(isBrevoKey('xkeysib-NOT_HEX-foo')).toBe(false);
  });
});
