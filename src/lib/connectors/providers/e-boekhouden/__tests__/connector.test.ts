import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EBoekhoudenConnector } from '@/lib/connectors/providers/e-boekhouden/connector';
import { __resetSessionCache } from '@/lib/connectors/providers/e-boekhouden/session-cache';
import type {
  EBoekhoudenAdministration,
  EBoekhoudenSessionResponse,
} from '@/lib/connectors/providers/e-boekhouden/types';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';

const SAMPLE_SESSION: EBoekhoudenSessionResponse = {
  token: 'sess_xyz',
  expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};
const SAMPLE_ADMIN: EBoekhoudenAdministration = {
  id: 'adm_1',
  name: 'Demo Restaurant Amsterdam B.V.',
  vatNumber: 'NL000099998B01',
  country: 'NL',
  currency: 'EUR',
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

const ctx = { tenantId: VILLA, userId: SUPER };

beforeEach(() => __resetSessionCache());
afterEach(() => __resetSessionCache());

describe('EBoekhoudenConnector definition', () => {
  it('declares the correct identity', () => {
    const c = new EBoekhoudenConnector({ sourceToken: 'src_test' });
    expect(c.id).toBe('e-boekhouden');
    expect(c.category).toBe('accounting');
    expect(c.authMethod).toBe('api_key');
    expect(c.availableIn).toEqual(['NL']);
  });

  it('exposes a single api-key field (user_api_token)', () => {
    const c = new EBoekhoudenConnector({ sourceToken: 'src_test' });
    const fields = c.apiKey?.fields ?? [];
    expect(fields.map((f) => f.key)).toEqual(['user_api_token']);
    const tokenField = fields.find((f) => f.key === 'user_api_token')!;
    expect(tokenField.required).toBe(true);
    expect(tokenField.type).toBe('password');
    expect(tokenField.validation?.minLength).toBeGreaterThanOrEqual(20);
  });
});

describe('EBoekhoudenConnector.testConnection', () => {
  it('returns ok=true with metadata when source token + valid user token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_SESSION))
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ADMIN))
      .mockResolvedValueOnce(new Response(null, { status: 204 })); // endSession cleanup
    const connector = new EBoekhoudenConnector({
      sourceToken: 'src_test',
      clientOverrides: { fetchImpl, cacheKey: 'success-key' },
    });
    const result = await connector.testConnection(
      { user_api_token: 'user_api_token_valid_long_enough' },
      ctx
    );
    expect(result.ok).toBe(true);
    expect(result.metadata?.administration_name).toBe(SAMPLE_ADMIN.name);
    expect(result.metadata?.administration_country).toBe('NL');
    expect(result.metadata?.vat_number).toBe('NL000099998B01');
    expect(result.metadata?.last_session_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns ok=false with CONFIGURATION_INCOMPLETE when source token missing', async () => {
    const connector = new EBoekhoudenConnector({ sourceToken: null });
    const result = await connector.testConnection(
      { user_api_token: 'user_api_token_value_long_enough' },
      ctx
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('CONFIGURATION_INCOMPLETE');
    expect(result.error).toMatch(/Source API Token/);
  });

  it('returns ok=false on 401 (invalid user token)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: 'invalid token' }));
    const connector = new EBoekhoudenConnector({
      sourceToken: 'src_test',
      clientOverrides: { fetchImpl, cacheKey: 'invalid-user' },
    });
    const result = await connector.testConnection(
      { user_api_token: 'user_api_token_value_long_enough' },
      ctx
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid|expired/i);
  });

  it('returns ok=false on 429 with rate-limit message', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_SESSION))
      .mockResolvedValueOnce(jsonResponse(429, { message: 'too many' }, { 'retry-after': '60' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })); // endSession
    const connector = new EBoekhoudenConnector({
      sourceToken: 'src_test',
      clientOverrides: { fetchImpl, cacheKey: 'rate-limited' },
    });
    const result = await connector.testConnection(
      { user_api_token: 'user_api_token_value_long_enough' },
      ctx
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('RATE_LIMITED');
  });

  it('returns ok=false when user_api_token is empty (defensive guard)', async () => {
    const connector = new EBoekhoudenConnector({ sourceToken: 'src_test' });
    const result = await connector.testConnection({ user_api_token: '' }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/user_api_token/);
  });

  it('falls back to process.env when sourceTokenOverride is not provided', async () => {
    const prev = process.env.EBOEKHOUDEN_SOURCE_API_TOKEN;
    delete process.env.EBOEKHOUDEN_SOURCE_API_TOKEN;
    try {
      const connector = new EBoekhoudenConnector();
      const result = await connector.testConnection(
        { user_api_token: 'user_api_token_value_long_enough' },
        ctx
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain('CONFIGURATION_INCOMPLETE');
    } finally {
      if (prev !== undefined) process.env.EBOEKHOUDEN_SOURCE_API_TOKEN = prev;
    }
  });
});
