import { describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { HubSpotClient } from '@/lib/connectors/providers/hubspot/client';
import { HUBSPOT_ERROR_CODES } from '@/lib/connectors/providers/hubspot/errors';
import type { HubSpotAccountInfo } from '@/lib/connectors/providers/hubspot/types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_ACCOUNT: HubSpotAccountInfo = {
  portalId: 12345678,
  accountType: 'STANDARD',
  timeZone: 'Europe/Amsterdam',
  companyCurrency: 'EUR',
  additionalCurrencies: ['USD'],
  utcOffset: '+01:00',
  utcOffsetMilliseconds: 3_600_000,
  uiDomain: 'app-eu1.hubspot.com',
  dataHostingLocation: 'EU',
};

describe('HubSpotClient constructor', () => {
  it('throws when accessToken is empty', () => {
    expect(() => new HubSpotClient({ accessToken: '' })).toThrow(/accessToken is required/);
  });

  it('accepts valid options', () => {
    expect(() => new HubSpotClient({ accessToken: 'CIo_test' })).not.toThrow();
  });
});

describe('HubSpotClient.getAccountInfo', () => {
  it('returns parsed HubSpotAccountInfo on 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new HubSpotClient({ accessToken: 'CIo_test', fetchImpl });
    const info = await client.getAccountInfo();
    expect(info.portalId).toBe(12345678);
    expect(info.accountType).toBe('STANDARD');
    expect(info.uiDomain).toBe('app-eu1.hubspot.com');
  });

  it('hits the v3 details endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new HubSpotClient({ accessToken: 'CIo_test', fetchImpl });
    await client.getAccountInfo();
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.hubapi.com/account-info/v3/details');
  });

  it('sends Authorization + User-Agent + Accept headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new HubSpotClient({ accessToken: 'CIo_test', fetchImpl });
    await client.getAccountInfo();
    const headers = fetchImpl.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer CIo_test');
    expect(headers['User-Agent']).toMatch(/Framewise/);
    expect(headers.Accept).toBe('application/json');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        status: 'error',
        message: 'Authentication credentials not found.',
      })
    );
    const client = new HubSpotClient({ accessToken: 'CIo_bad', fetchImpl });
    await expect(client.getAccountInfo()).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws RATE_LIMITED ConnectorError on 429', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { status: 'error', message: 'You have reached your daily limit' })
      );
    const client = new HubSpotClient({ accessToken: 'CIo_test', fetchImpl });
    await expect(client.getAccountInfo()).rejects.toMatchObject({
      code: HUBSPOT_ERROR_CODES.RATE_LIMITED,
    });
  });

  it('throws INSUFFICIENT_PERMISSIONS on 403', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(403, {
        status: 'error',
        message: "This app hasn't been granted all required scopes",
        category: 'MISSING_SCOPES',
      })
    );
    const client = new HubSpotClient({ accessToken: 'CIo_test', fetchImpl });
    await expect(client.getAccountInfo()).rejects.toMatchObject({
      code: HUBSPOT_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    });
  });

  it('honours custom baseUrl override', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new HubSpotClient({
      accessToken: 'CIo_test',
      baseUrl: 'https://hubspot.mock.test',
      fetchImpl,
    });
    await client.getAccountInfo();
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://hubspot.mock.test/account-info/v3/details');
  });

  it('wraps AbortError as NETWORK_ERROR via hubspotNetworkError', async () => {
    const fetchImpl = vi.fn().mockImplementationOnce(async () => {
      const e = new Error('aborted');
      (e as { name?: string }).name = 'AbortError';
      throw e;
    });
    const client = new HubSpotClient({ accessToken: 'CIo_test', fetchImpl, timeoutMs: 50 });
    await expect(client.getAccountInfo()).rejects.toMatchObject({
      code: HUBSPOT_ERROR_CODES.NETWORK_ERROR,
    });
  });

  it('does not retry on 5xx (caller decides)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { status: 'error', message: 'oops' }));
    const client = new HubSpotClient({ accessToken: 'CIo_test', fetchImpl });
    await expect(client.getAccountInfo()).rejects.toBeInstanceOf(ConnectorError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
