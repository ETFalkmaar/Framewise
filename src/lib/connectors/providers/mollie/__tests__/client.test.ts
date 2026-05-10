import { describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { MollieClient, isMollieKey } from '@/lib/connectors/providers/mollie/client';
import { MOLLIE_ERROR_CODES } from '@/lib/connectors/providers/mollie/errors';
import type {
  MollieOrganization,
  MolliePaymentMethod,
} from '@/lib/connectors/providers/mollie/types';

const SAMPLE_ORG: MollieOrganization = {
  id: 'org_12345',
  name: 'Demo Restaurant Amsterdam B.V.',
  email: 'owner@demo-restaurant.example',
  locale: 'nl_NL',
  address: {
    streetAndNumber: 'Damrak 12',
    postalCode: '1012LP',
    city: 'Amsterdam',
    country: 'NL',
  },
  vatNumber: 'NL000099998B01',
};

const IDEAL: MolliePaymentMethod = {
  id: 'ideal',
  description: 'iDEAL',
  image: { size1x: 'https://x', size2x: 'https://x@2x' },
  status: 'activated',
};
const CARD: MolliePaymentMethod = {
  id: 'creditcard',
  description: 'Credit card',
  image: { size1x: 'https://y', size2x: 'https://y@2x' },
  status: 'activated',
};
const PENDING: MolliePaymentMethod = {
  id: 'klarnapaylater',
  description: 'Klarna Pay later',
  image: { size1x: 'https://z', size2x: 'https://z@2x' },
  status: 'pending-review',
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

function client(fetchImpl: typeof fetch, apiKey = 'test_dummy_key_for_unit_tests_xxxxxxx') {
  return new MollieClient({ apiKey, fetchImpl, timeoutMs: 5_000 });
}

describe('MollieClient.getOrganization', () => {
  it('returns the parsed organization on 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_ORG));
    const result = await client(fetchImpl).getOrganization();
    expect(result).toEqual(SAMPLE_ORG);
  });

  it('hits /organizations/me with Bearer auth + JSON headers + UA', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_ORG));
    await client(fetchImpl).getOrganization();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.mollie.com/v2/organizations/me');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test_dummy_key_for_unit_tests_xxxxxxx');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['User-Agent']).toContain('Framewise');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { detail: 'invalid api key' }));
    await expect(client(fetchImpl).getOrganization()).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
  });

  it('passes an AbortSignal so timeouts are honoured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_ORG));
    await client(fetchImpl).getOrganization();
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('AbortError → mollieNetworkError', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    let caught: unknown;
    try {
      await client(fetchImpl).getOrganization();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConnectorError);
    expect((caught as ConnectorError).code).toBe(MOLLIE_ERROR_CODES.NETWORK_ERROR);
    expect((caught as ConnectorError).message).toContain('timed out');
  });
});

describe('MollieClient.listMethods', () => {
  it('extracts _embedded.methods array', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { _embedded: { methods: [IDEAL, CARD, PENDING] } }));
    const result = await client(fetchImpl).listMethods();
    expect(result).toEqual([IDEAL, CARD, PENDING]);
  });

  it('returns [] when _embedded.methods is missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const result = await client(fetchImpl).listMethods();
    expect(result).toEqual([]);
  });

  it('returns [] when API replies with empty envelope', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { _embedded: {} }));
    const result = await client(fetchImpl).listMethods();
    expect(result).toEqual([]);
  });

  it('429 surfaces RATE_LIMITED', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(429, { detail: 'slow down' }, { 'retry-after': '120' }));
    let caught: unknown;
    try {
      await client(fetchImpl).listMethods();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConnectorError);
    expect((caught as ConnectorError).code).toBe(MOLLIE_ERROR_CODES.RATE_LIMITED);
  });
});

describe('MollieClient.getKeyType', () => {
  it('test_xxx → "test"', () => {
    const c = client(vi.fn(), 'test_abc1234567890def1234567890ghi');
    expect(c.getKeyType()).toBe('test');
  });

  it('live_xxx → "live"', () => {
    const c = client(vi.fn(), 'live_abc1234567890def1234567890ghi');
    expect(c.getKeyType()).toBe('live');
  });

  it('throws on unknown prefix', () => {
    const c = client(vi.fn(), 'sandbox_abc1234567890def1234567890ghi');
    expect(() => c.getKeyType()).toThrow(/test_|live_/);
  });

  it('throws on empty constructor key', () => {
    expect(() => new MollieClient({ apiKey: '', fetchImpl: vi.fn() })).toThrow();
  });
});

describe('isMollieKey helper', () => {
  it('accepts both prefixes with sufficient length', () => {
    expect(isMollieKey('test_aaaaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(isMollieKey('live_aaaaaaaaaaaaaaaaaaaa')).toBe(true);
  });

  it('rejects bad prefixes / short bodies', () => {
    expect(isMollieKey('this_is_invalid')).toBe(false);
    expect(isMollieKey('test_short')).toBe(false);
    expect(isMollieKey('LIVE_aaaaaaaaaaaaaaaaaaaa')).toBe(false);
  });
});
