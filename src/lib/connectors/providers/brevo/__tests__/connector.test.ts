import { describe, expect, it, vi } from 'vitest';
import { BrevoConnector } from '@/lib/connectors/providers/brevo/connector';
import { BREVO_ERROR_CODES } from '@/lib/connectors/providers/brevo/errors';
import type { BrevoAccount } from '@/lib/connectors/providers/brevo/types';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';

const FREE_ACCOUNT: BrevoAccount = {
  email: 'owner@demo-restaurant.example',
  firstName: 'Demo',
  lastName: 'Owner',
  companyName: 'Demo Restaurant Amsterdam B.V.',
  address: { street: '123 Main', city: 'Amsterdam', zipCode: '1011AA', country: 'NL' },
  plan: [{ type: 'free', creditsType: 'sendLimit', credits: 9000 }],
};

const PAID_ACCOUNT: BrevoAccount = {
  email: 'owner@bigco.example',
  firstName: 'Big',
  lastName: 'Co',
  companyName: 'BigCo BV',
  address: { country: 'NL' },
  plan: [
    { type: 'subscription', creditsType: 'sendLimit', credits: 100_000 },
    { type: 'sms', creditsType: 'sms', credits: 5_000 },
  ],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ctx = { tenantId: VILLA, userId: SUPER };

describe('BrevoConnector definition', () => {
  it('declares the correct identity', () => {
    const c = new BrevoConnector();
    expect(c.id).toBe('brevo');
    expect(c.category).toBe('newsletter');
    expect(c.authMethod).toBe('api_key');
    expect(c.availableIn).toEqual(['NL', 'CW']);
  });

  it('exposes a single api-key field with xkeysib pattern', () => {
    const c = new BrevoConnector();
    const field = c.apiKey?.fields[0];
    expect(field?.key).toBe('api_key');
    expect(field?.required).toBe(true);
    expect(field?.type).toBe('password');
    expect(field?.validation?.pattern).toContain('xkeysib');
  });
});

describe('BrevoConnector.testConnection', () => {
  it('returns ok=true with metadata for a free-tier account', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, FREE_ACCOUNT));
    const c = new BrevoConnector({ fetchImpl });
    const result = await c.testConnection(
      { api_key: 'xkeysib-deadbeef0123456789abcdef-someAlphaNum1234' },
      ctx
    );
    expect(result.ok).toBe(true);
    expect(result.metadata?.email).toBe('owner@demo-restaurant.example');
    expect(result.metadata?.company_name).toBe('Demo Restaurant Amsterdam B.V.');
    expect(result.metadata?.full_name).toBe('Demo Owner');
    expect(result.metadata?.country).toBe('NL');
    expect(result.metadata?.plan_type).toBe('free');
    expect(result.metadata?.is_free_tier).toBe(true);
    expect(result.metadata?.credits_remaining).toBe(9000);
  });

  it('returns ok=true with is_free_tier=false for a paid plan', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, PAID_ACCOUNT));
    const c = new BrevoConnector({ fetchImpl });
    const result = await c.testConnection(
      { api_key: 'xkeysib-deadbeef0123456789abcdef-someAlphaNum1234' },
      ctx
    );
    expect(result.ok).toBe(true);
    expect(result.metadata?.plan_type).toBe('subscription');
    expect(result.metadata?.is_free_tier).toBe(false);
    // Paid + SMS add-on summed.
    expect(result.metadata?.credits_remaining).toBe(105_000);
  });

  it('returns ok=false on 401 (invalid key)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: 'unauthorized', message: 'Key not found' }));
    const c = new BrevoConnector({ fetchImpl });
    const result = await c.testConnection(
      { api_key: 'xkeysib-deadbeef0123456789abcdef-someAlphaNum1234' },
      ctx
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid|revoked/i);
    expect(result.error).toContain('Key not found');
  });

  it('returns ok=false on 429 with rate-limit message', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { code: 'rate_limit_exceeded', message: 'Too many calls' })
      );
    const c = new BrevoConnector({ fetchImpl });
    const result = await c.testConnection(
      { api_key: 'xkeysib-deadbeef0123456789abcdef-someAlphaNum1234' },
      ctx
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain(BREVO_ERROR_CODES.RATE_LIMITED);
  });

  it('returns ok=false when api_key is empty (defensive guard)', async () => {
    const fetchImpl = vi.fn();
    const c = new BrevoConnector({ fetchImpl });
    const result = await c.testConnection({ api_key: '' }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/api_key/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('handles missing address gracefully', async () => {
    const account: BrevoAccount = { ...FREE_ACCOUNT, address: undefined };
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, account));
    const c = new BrevoConnector({ fetchImpl });
    const result = await c.testConnection(
      { api_key: 'xkeysib-deadbeef0123456789abcdef-someAlphaNum1234' },
      ctx
    );
    expect(result.ok).toBe(true);
    expect(result.metadata?.country).toBeUndefined();
  });

  it('handles empty plan list (treats as unknown plan, 0 credits)', async () => {
    const account: BrevoAccount = { ...FREE_ACCOUNT, plan: [] };
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, account));
    const c = new BrevoConnector({ fetchImpl });
    const result = await c.testConnection(
      { api_key: 'xkeysib-deadbeef0123456789abcdef-someAlphaNum1234' },
      ctx
    );
    expect(result.ok).toBe(true);
    expect(result.metadata?.plan_type).toBe('unknown');
    expect(result.metadata?.is_free_tier).toBe(false);
    expect(result.metadata?.credits_remaining).toBe(0);
  });

  it('trims full_name when only first name is present', async () => {
    const account: BrevoAccount = { ...FREE_ACCOUNT, firstName: 'Demo', lastName: '' };
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, account));
    const c = new BrevoConnector({ fetchImpl });
    const result = await c.testConnection(
      { api_key: 'xkeysib-deadbeef0123456789abcdef-someAlphaNum1234' },
      ctx
    );
    expect(result.metadata?.full_name).toBe('Demo');
  });

  it('issues a single GET /account request', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, FREE_ACCOUNT));
    const c = new BrevoConnector({ fetchImpl });
    await c.testConnection({ api_key: 'xkeysib-deadbeef0123456789abcdef-someAlphaNum1234' }, ctx);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.brevo.com/v3/account');
  });
});
