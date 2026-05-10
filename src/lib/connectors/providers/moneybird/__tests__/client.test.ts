import { describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { MoneybirdClient } from '@/lib/connectors/providers/moneybird/client';
import { MONEYBIRD_ERROR_CODES } from '@/lib/connectors/providers/moneybird/errors';
import type { MoneybirdAdministration } from '@/lib/connectors/providers/moneybird/types';

const SAMPLE_ADMIN: MoneybirdAdministration = {
  id: '123456789012345',
  name: 'Mijn Bedrijf BV',
  language: 'nl',
  currency: 'EUR',
  country: 'NL',
  time_zone: 'Europe/Amsterdam',
};

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function client(fetchImpl: typeof fetch, overrides: { timeoutMs?: number } = {}) {
  return new MoneybirdClient({
    accessToken: 'test_token_value',
    fetchImpl,
    timeoutMs: overrides.timeoutMs ?? 5_000,
  });
}

describe('MoneybirdClient.listAdministrations', () => {
  it('returns the parsed array on 200', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, [SAMPLE_ADMIN]));
    const result = await client(mockFetch).listAdministrations();
    expect(result).toEqual([SAMPLE_ADMIN]);
  });

  it('hits the canonical /administrations.json path', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, []));
    await client(mockFetch).listAdministrations();
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://moneybird.com/api/v2/administrations.json');
  });

  it('sets Authorization, Accept, Content-Type and User-Agent headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, []));
    await client(mockFetch).listAdministrations();
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test_token_value');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['User-Agent']).toContain('Framewise');
  });

  it('passes an AbortSignal so timeouts are honoured', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, []));
    await client(mockFetch).listAdministrations();
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('401 → InvalidCredentialsError', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Invalid token' }));
    await expect(client(mockFetch).listAdministrations()).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
  });

  it('429 → ConnectorError(RATE_LIMITED) with retry-after detail', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(429, { error: 'rate limited' }, { 'retry-after': '120' }));
    let caught: unknown;
    try {
      await client(mockFetch).listAdministrations();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConnectorError);
    expect((caught as ConnectorError).code).toBe(MONEYBIRD_ERROR_CODES.RATE_LIMITED);
    expect((caught as ConnectorError).details?.retryAfter).toBe('120');
  });

  it('5xx → ConnectorError(PROVIDER_ERROR)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(503, { message: 'maintenance' }));
    let caught: unknown;
    try {
      await client(mockFetch).listAdministrations();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConnectorError);
    expect((caught as ConnectorError).code).toBe(MONEYBIRD_ERROR_CODES.PROVIDER_ERROR);
  });

  it('AbortError (timeout) → ConnectorError(NETWORK_ERROR)', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    let caught: unknown;
    try {
      await client(mockFetch).listAdministrations();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConnectorError);
    expect((caught as ConnectorError).code).toBe(MONEYBIRD_ERROR_CODES.NETWORK_ERROR);
    expect((caught as ConnectorError).message).toContain('timed out');
  });

  it('returns [] when API replies with a non-array (defensive)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, { unexpected: 'shape' }));
    const result = await client(mockFetch).listAdministrations();
    expect(result).toEqual([]);
  });

  it('throws on empty accessToken', () => {
    expect(
      () =>
        new MoneybirdClient({
          accessToken: '',
          fetchImpl: vi.fn(),
        })
    ).toThrow();
  });
});

describe('MoneybirdClient.getAdministration', () => {
  it('uses the encoded id in the URL path', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_ADMIN));
    await client(mockFetch).getAdministration('123 456');
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://moneybird.com/api/v2/administrations/123%20456.json');
  });
});
