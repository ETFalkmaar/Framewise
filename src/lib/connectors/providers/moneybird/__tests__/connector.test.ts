import { describe, expect, it, vi } from 'vitest';
import { MoneybirdConnector } from '@/lib/connectors/providers/moneybird/connector';
import type { MoneybirdAdministration } from '@/lib/connectors/providers/moneybird/types';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';

const ADMIN_A: MoneybirdAdministration = {
  id: '111000111',
  name: 'Demo BV',
  language: 'nl',
  currency: 'EUR',
  country: 'NL',
  time_zone: 'Europe/Amsterdam',
};
const ADMIN_B: MoneybirdAdministration = {
  id: '222000222',
  name: 'Restaurant BV',
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

function makeConnector(fetchImpl: typeof fetch) {
  return new MoneybirdConnector({ fetchImpl });
}

const ctx = { tenantId: VILLA, userId: SUPER };

describe('MoneybirdConnector definition', () => {
  it('declares the correct identity', () => {
    const c = makeConnector(vi.fn());
    expect(c.id).toBe('moneybird');
    expect(c.category).toBe('accounting');
    expect(c.authMethod).toBe('api_key');
    expect(c.availableIn).toEqual(['NL']);
  });

  it('exposes two api-key fields (token + admin id)', () => {
    const c = makeConnector(vi.fn());
    const fields = c.apiKey?.fields ?? [];
    expect(fields.map((f) => f.key)).toEqual(['access_token', 'administration_id']);
    const tokenField = fields.find((f) => f.key === 'access_token')!;
    expect(tokenField.required).toBe(true);
    expect(tokenField.type).toBe('password');
    const adminField = fields.find((f) => f.key === 'administration_id')!;
    expect(adminField.required).toBe(false);
    expect(adminField.validation?.pattern).toBeDefined();
  });
});

describe('MoneybirdConnector.testConnection', () => {
  it('returns ok=true with metadata for a valid token', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, [ADMIN_A]));
    const c = makeConnector(mockFetch);
    const result = await c.testConnection({ access_token: 'valid' }, ctx);
    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      primary_administration_id: ADMIN_A.id,
      primary_administration_name: ADMIN_A.name,
      administrations_count: 1,
    });
  });

  it('returns ok=false when the token has no administrations', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, []));
    const c = makeConnector(mockFetch);
    const result = await c.testConnection({ access_token: 'valid_no_admins' }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no administrations/i);
  });

  it('returns ok=false on 401 (invalid token)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'token expired' }));
    const c = makeConnector(mockFetch);
    const result = await c.testConnection({ access_token: 'invalid' }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid|expired/i);
  });

  it('returns ok=false on 429 with rate-limit message', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(429, { error: 'too many' }, { 'retry-after': '30' }));
    const c = makeConnector(mockFetch);
    const result = await c.testConnection({ access_token: 'valid' }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('RATE_LIMITED');
  });

  it('selects the requested administration when administration_id matches', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, [ADMIN_A, ADMIN_B]));
    const c = makeConnector(mockFetch);
    const result = await c.testConnection(
      { access_token: 'valid', administration_id: ADMIN_B.id },
      ctx
    );
    expect(result.ok).toBe(true);
    expect(result.metadata?.primary_administration_id).toBe(ADMIN_B.id);
    expect(result.metadata?.primary_administration_name).toBe(ADMIN_B.name);
    expect(result.metadata?.administrations_count).toBe(2);
  });

  it('returns ok=false when administration_id is unknown to the token', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, [ADMIN_A]));
    const c = makeConnector(mockFetch);
    const result = await c.testConnection(
      { access_token: 'valid', administration_id: 'this-id-does-not-exist' },
      ctx
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not visible/i);
  });

  it('returns ok=false when access_token is empty (defensive guard)', async () => {
    const c = makeConnector(vi.fn());
    const result = await c.testConnection({ access_token: '' }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/access_token/);
  });
});
