import { describe, expect, it, vi } from 'vitest';
import { HubSpotConnector } from '@/lib/connectors/providers/hubspot/connector';
import { HUBSPOT_ERROR_CODES } from '@/lib/connectors/providers/hubspot/errors';
import type { HubSpotAccountInfo } from '@/lib/connectors/providers/hubspot/types';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';

const TEST_CONFIG = {
  clientId: 'cid_test_xxx',
  clientSecret: 'csecret_test_yyy',
};

const SAMPLE_ACCOUNT: HubSpotAccountInfo = {
  portalId: 12345678,
  accountType: 'STANDARD',
  timeZone: 'Europe/Amsterdam',
  companyCurrency: 'EUR',
  additionalCurrencies: ['USD'],
  utcOffset: '+01:00',
  utcOffsetMilliseconds: 3_600_000,
  uiDomain: 'app-eu1.hubspot.com',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ctx = { tenantId: VILLA, userId: SUPER };

describe('HubSpotConnector definition', () => {
  it('declares the correct identity', () => {
    const c = new HubSpotConnector();
    expect(c.id).toBe('hubspot');
    expect(c.category).toBe('crm');
    expect(c.authMethod).toBe('oauth');
    expect(c.availableIn).toEqual(['NL', 'CW']);
    expect(c.oauth?.scopes).toEqual([
      'oauth',
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
    ]);
    expect(c.oauth?.requiresClientSecret).toBe(true);
    expect(c.oauth?.pkce).toBe(false);
  });

  it('hasConfig() reflects the override', () => {
    const withConfig = new HubSpotConnector({ oauthOverrides: { config: TEST_CONFIG } });
    const withoutConfig = new HubSpotConnector({ oauthOverrides: { config: null } });
    expect(withConfig.hasConfig()).toBe(true);
    expect(withoutConfig.hasConfig()).toBe(false);
  });
});

describe('HubSpotConnector.getAuthorizeUrl', () => {
  it('returns a valid URL with state + scopes when config present', async () => {
    const c = new HubSpotConnector({ oauthOverrides: { config: TEST_CONFIG } });
    const url = await c.getAuthorizeUrl({
      state: 'st_abc',
      callbackUrl: 'https://app.example/api/connectors/oauth/callback?providerId=hubspot',
    });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('app.hubspot.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('cid_test_xxx');
    expect(parsed.searchParams.get('state')).toBe('st_abc');
    expect(parsed.searchParams.get('scope')).toContain('crm.objects.contacts.read');
    expect(parsed.searchParams.get('scope')).toContain('crm.objects.contacts.write');
  });

  it('caches the redirect URI for callback echo-back', async () => {
    const c = new HubSpotConnector({ oauthOverrides: { config: TEST_CONFIG } });
    await c.getAuthorizeUrl({
      state: 'st',
      callbackUrl: 'https://app.example/cb-special',
    });
    // Inspect via a second call: handleOAuthCallback should reuse this.
    // We can't read private field directly, but we can verify by triggering
    // exchangeCodeForToken with a mocked fetch and asserting the body.
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A',
          refresh_token: 'R',
          token_type: 'bearer',
          expires_in: 1800,
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const c2 = new HubSpotConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c2.getAuthorizeUrl({ state: 'st2', callbackUrl: 'https://app.example/cb-cached' });
    await c2.handleOAuthCallback({ code: 'c', state: 'st2', context: ctx });
    expect(fetchImpl.mock.calls[0]![1]?.body as string).toContain(
      'redirect_uri=https%3A%2F%2Fapp.example%2Fcb-cached'
    );
  });

  it('throws CONFIGURATION_INCOMPLETE when config missing', async () => {
    const c = new HubSpotConnector({ oauthOverrides: { config: null } });
    await expect(
      c.getAuthorizeUrl({
        state: 'st_abc',
        callbackUrl: 'https://app.example/cb',
      })
    ).rejects.toMatchObject({
      code: HUBSPOT_ERROR_CODES.CONFIGURATION_INCOMPLETE,
    });
  });
});

describe('HubSpotConnector.handleOAuthCallback', () => {
  it('returns ok=false with clear error when config missing', async () => {
    const c = new HubSpotConnector({ oauthOverrides: { config: null } });
    const result = await c.handleOAuthCallback({
      code: 'C',
      state: 'st',
      context: ctx,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/configured|support/i);
  });

  it('returns ok=true with complete metadata on successful round-trip', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'CIo_access',
          refresh_token: 'CIo_refresh',
          token_type: 'bearer',
          expires_in: 1800,
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));

    const c = new HubSpotConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({
      code: 'C_test',
      state: 'st',
      context: ctx,
    });

    expect(result.ok).toBe(true);
    expect(result.credentials?.access_token).toBe('CIo_access');
    expect(result.credentials?.refresh_token).toBe('CIo_refresh');
    expect(result.credentials?.expires_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(result.metadata).toMatchObject({
      portal_id: '12345678',
      account_type: 'STANDARD',
      company_currency: 'EUR',
      ui_domain: 'app-eu1.hubspot.com',
      time_zone: 'Europe/Amsterdam',
    });
    expect(result.metadata?.expires_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('persists portal_id as a string (not number)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A',
          refresh_token: 'R',
          token_type: 'bearer',
          expires_in: 1800,
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const c = new HubSpotConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    expect(typeof result.metadata?.portal_id).toBe('string');
    expect(result.metadata?.portal_id).toBe('12345678');
  });

  it('returns ok=false when token exchange returns 401 (invalid credentials)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        status: 'BAD_AUTH_CODE',
        message: 'invalid client credentials',
      })
    );
    const c = new HubSpotConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({
      code: 'C_bad',
      state: 'st',
      context: ctx,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid|expired|rejected|credentials/i);
  });

  it('still succeeds when getAccountInfo probe fails (best-effort enrichment)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A',
          refresh_token: 'R',
          token_type: 'bearer',
          expires_in: 1800,
        })
      )
      .mockResolvedValueOnce(jsonResponse(500, { status: 'error', message: 'oops' }));

    const c = new HubSpotConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    expect(result.ok).toBe(true);
    // Only `expires_at` is guaranteed when probe fails.
    expect(result.metadata?.portal_id).toBeUndefined();
    expect(result.metadata?.expires_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('exposes refresh_token + expires_at on the credentials envelope', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A_main',
          refresh_token: 'R_persisted',
          token_type: 'bearer',
          expires_in: 1800,
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));

    const c = new HubSpotConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    expect(result.credentials?.refresh_token).toBe('R_persisted');
    expect(result.credentials?.expires_at).toBeTruthy();
  });
});
