import { describe, expect, it, vi } from 'vitest';
import { MollieConnector } from '@/lib/connectors/providers/mollie/connector';
import type {
  MollieOrganization,
  MolliePaymentMethod,
} from '@/lib/connectors/providers/mollie/types';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';

const SAMPLE_ORG: MollieOrganization = {
  id: 'org_12345',
  name: 'Demo Restaurant Amsterdam B.V.',
  email: 'owner@demo-restaurant.example',
  locale: 'nl_NL',
  address: { city: 'Amsterdam', country: 'NL' },
};

const IDEAL: MolliePaymentMethod = {
  id: 'ideal',
  description: 'iDEAL',
  image: { size1x: '', size2x: '' },
  status: 'activated',
};
const CARD: MolliePaymentMethod = {
  id: 'creditcard',
  description: 'Credit card',
  image: { size1x: '', size2x: '' },
  status: 'activated',
};
const PENDING: MolliePaymentMethod = {
  id: 'klarnapaylater',
  description: 'Klarna',
  image: { size1x: '', size2x: '' },
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

function makeConnector(fetchImpl: typeof fetch) {
  return new MollieConnector({ fetchImpl });
}

const ctx = { tenantId: VILLA, userId: SUPER };
const TEST_KEY = 'test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const LIVE_KEY = 'live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('MollieConnector definition', () => {
  it('declares the correct identity', () => {
    const c = makeConnector(vi.fn());
    expect(c.id).toBe('mollie');
    expect(c.category).toBe('payments');
    expect(c.authMethod).toBe('api_key');
    expect(c.availableIn).toEqual(['NL']);
  });

  it('exposes a single api-key field with test|live regex', () => {
    const c = makeConnector(vi.fn());
    const field = c.apiKey?.fields[0];
    expect(field?.key).toBe('api_key');
    expect(field?.required).toBe(true);
    expect(field?.type).toBe('password');
    expect(field?.validation?.pattern).toContain('test|live');
  });
});

describe('MollieConnector.testConnection', () => {
  it('returns ok=true with metadata.key_type=test for a test key', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ORG))
      .mockResolvedValueOnce(jsonResponse(200, { _embedded: { methods: [IDEAL, CARD] } }));
    const result = await makeConnector(fetchImpl).testConnection({ api_key: TEST_KEY }, ctx);
    expect(result.ok).toBe(true);
    expect(result.metadata?.key_type).toBe('test');
    expect(result.metadata?.organization_id).toBe('org_12345');
    expect(result.metadata?.organization_name).toBe(SAMPLE_ORG.name);
    expect(result.metadata?.country).toBe('NL');
    expect(result.metadata?.active_methods).toEqual(['creditcard', 'ideal']);
    expect(result.metadata?.active_methods_count).toBe(2);
  });

  it('returns ok=true with metadata.key_type=live for a live key', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ORG))
      .mockResolvedValueOnce(jsonResponse(200, { _embedded: { methods: [IDEAL] } }));
    const result = await makeConnector(fetchImpl).testConnection({ api_key: LIVE_KEY }, ctx);
    expect(result.ok).toBe(true);
    expect(result.metadata?.key_type).toBe('live');
  });

  it('filters out non-activated methods from active_methods', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ORG))
      .mockResolvedValueOnce(jsonResponse(200, { _embedded: { methods: [IDEAL, PENDING] } }));
    const result = await makeConnector(fetchImpl).testConnection({ api_key: TEST_KEY }, ctx);
    expect(result.metadata?.active_methods).toEqual(['ideal']);
    expect(result.metadata?.active_methods_count).toBe(1);
  });

  it('returns ok=true with active_methods_count=0 when no methods activated', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ORG))
      .mockResolvedValueOnce(jsonResponse(200, { _embedded: { methods: [PENDING] } }));
    const result = await makeConnector(fetchImpl).testConnection({ api_key: TEST_KEY }, ctx);
    expect(result.ok).toBe(true);
    expect(result.metadata?.active_methods).toEqual([]);
    expect(result.metadata?.active_methods_count).toBe(0);
  });

  it('returns ok=false on 401 (invalid key)', async () => {
    // testConnection issues TWO parallel requests (organization + methods).
    // The same Response can only be read once, so each call needs a fresh
    // Response object — use mockImplementation, not mockResolvedValue.
    const fetchImpl = vi
      .fn()
      .mockImplementation(async () => jsonResponse(401, { detail: 'invalid api key' }));
    const result = await makeConnector(fetchImpl).testConnection({ api_key: TEST_KEY }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid|revoked/i);
  });

  it('returns ok=false on 429 with rate-limit message', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementation(async () =>
        jsonResponse(429, { detail: 'too many' }, { 'retry-after': '60' })
      );
    const result = await makeConnector(fetchImpl).testConnection({ api_key: TEST_KEY }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('RATE_LIMITED');
  });

  it('returns ok=false when api_key is empty (defensive guard)', async () => {
    const result = await makeConnector(vi.fn()).testConnection({ api_key: '' }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/api_key/);
  });

  it('returns ok=false when key prefix is not test_/live_', async () => {
    const fetchImpl = vi.fn();
    const result = await makeConnector(fetchImpl).testConnection(
      { api_key: 'sandbox_aaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      ctx
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/test_|live_/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('issues two parallel requests (organization + methods)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ORG))
      .mockResolvedValueOnce(jsonResponse(200, { _embedded: { methods: [IDEAL] } }));
    await makeConnector(fetchImpl).testConnection({ api_key: TEST_KEY }, ctx);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const urls = fetchImpl.mock.calls.map((c) => c[0]);
    expect(urls).toContain('https://api.mollie.com/v2/organizations/me');
    expect(urls).toContain('https://api.mollie.com/v2/methods');
  });
});
