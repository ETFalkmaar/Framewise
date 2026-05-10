import { describe, expect, it, vi } from 'vitest';
import { PayPalConnector } from '@/lib/connectors/providers/paypal/connector';
import { PAYPAL_ERROR_CODES } from '@/lib/connectors/providers/paypal/errors';
import type { PayPalUserInfo } from '@/lib/connectors/providers/paypal/types';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';

const SANDBOX_CONFIG = {
  clientId: 'AY_sandbox_client',
  clientSecret: 'EL_sandbox_secret',
  environment: 'sandbox' as const,
};
const LIVE_CONFIG = {
  clientId: 'AY_live_client',
  clientSecret: 'EL_live_secret',
  environment: 'live' as const,
};

const SAMPLE_USER: PayPalUserInfo = {
  user_id: 'https://www.paypal.com/webapps/auth/identity/user/abc123',
  name: 'Demo Restaurant Amsterdam B.V.',
  email: 'owner@demo-restaurant.example',
  email_verified: true,
  payer_id: 'PAYER123ABC',
  address: { country_code: 'NL' },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ctx = { tenantId: VILLA, userId: SUPER };

describe('PayPalConnector definition', () => {
  it('declares the correct identity', () => {
    const c = new PayPalConnector();
    expect(c.id).toBe('paypal-business');
    expect(c.category).toBe('payments');
    expect(c.authMethod).toBe('oauth');
    expect(c.availableIn).toEqual(['NL', 'CW']);
    expect(c.oauth?.scopes).toEqual([
      'openid',
      'profile',
      'email',
      'https://uri.paypal.com/services/paypalattributes',
    ]);
    expect(c.oauth?.requiresClientSecret).toBe(true);
    expect(c.oauth?.pkce).toBe(false);
  });

  it('hasConfig() reflects the override', () => {
    const withConfig = new PayPalConnector({
      oauthOverrides: { config: SANDBOX_CONFIG },
    });
    const withoutConfig = new PayPalConnector({ oauthOverrides: { config: null } });
    expect(withConfig.hasConfig()).toBe(true);
    expect(withoutConfig.hasConfig()).toBe(false);
  });

  it('getEnvironment falls through to sandbox when no config', () => {
    const c = new PayPalConnector({ oauthOverrides: { config: null } });
    expect(c.getEnvironment()).toBe('sandbox');
  });

  it('getEnvironment reflects live config', () => {
    const c = new PayPalConnector({ oauthOverrides: { config: LIVE_CONFIG } });
    expect(c.getEnvironment()).toBe('live');
  });
});

describe('PayPalConnector.getAuthorizeUrl', () => {
  it('returns the sandbox URL with state + scopes when config present', async () => {
    const c = new PayPalConnector({ oauthOverrides: { config: SANDBOX_CONFIG } });
    const url = await c.getAuthorizeUrl({
      state: 'st_abc',
      callbackUrl: 'https://app.example/api/connectors/oauth/callback?providerId=paypal-business',
    });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('www.sandbox.paypal.com');
    expect(parsed.pathname).toBe('/connect');
    expect(parsed.searchParams.get('client_id')).toBe('AY_sandbox_client');
    expect(parsed.searchParams.get('state')).toBe('st_abc');
    expect(parsed.searchParams.get('scope')).toContain('openid');
    expect(parsed.searchParams.get('scope')).toContain('paypalattributes');
  });

  it('returns the live URL when config.environment=live', async () => {
    const c = new PayPalConnector({ oauthOverrides: { config: LIVE_CONFIG } });
    const url = await c.getAuthorizeUrl({
      state: 'st',
      callbackUrl: 'https://app.example/cb',
    });
    expect(new URL(url).hostname).toBe('www.paypal.com');
  });

  it('throws CONFIGURATION_INCOMPLETE when config missing', async () => {
    const c = new PayPalConnector({ oauthOverrides: { config: null } });
    await expect(
      c.getAuthorizeUrl({
        state: 'st_abc',
        callbackUrl: 'https://app.example/cb',
      })
    ).rejects.toMatchObject({
      code: PAYPAL_ERROR_CODES.CONFIGURATION_INCOMPLETE,
    });
  });
});

describe('PayPalConnector.handleOAuthCallback', () => {
  it('returns ok=false with clear error when config missing', async () => {
    const c = new PayPalConnector({ oauthOverrides: { config: null } });
    const result = await c.handleOAuthCallback({
      code: 'C_test',
      state: 'st_abc',
      context: ctx,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/configured|support/i);
  });

  it('returns ok=true with complete metadata on successful round-trip', async () => {
    const fetchImpl = vi
      .fn()
      // 1st call: token exchange
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A21_connected',
          refresh_token: 'R23_refresh',
          token_type: 'Bearer',
          expires_in: 32400,
          scope: 'openid profile email',
        })
      )
      // 2nd call: getUserInfo probe
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_USER));

    const c = new PayPalConnector({
      oauthOverrides: { config: SANDBOX_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    // Prime the redirect-uri cache so token exchange has the right value.
    await c.getAuthorizeUrl({
      state: 'st',
      callbackUrl: 'https://app.example/cb',
    });
    const result = await c.handleOAuthCallback({
      code: 'C_test',
      state: 'st',
      context: ctx,
    });

    expect(result.ok).toBe(true);
    expect(result.credentials?.access_token).toBe('A21_connected');
    expect(result.credentials?.refresh_token).toBe('R23_refresh');
    expect(result.credentials?.expires_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(result.metadata).toMatchObject({
      user_id: SAMPLE_USER.user_id,
      payer_id: 'PAYER123ABC',
      name: 'Demo Restaurant Amsterdam B.V.',
      email: 'owner@demo-restaurant.example',
      email_verified: true,
      environment: 'sandbox',
      account_country: 'NL',
    });
  });

  it('falls back to email when name absent', async () => {
    const userNoName = { ...SAMPLE_USER, name: undefined };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A21_connected',
          token_type: 'Bearer',
          expires_in: 32400,
          scope: 'openid',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, userNoName));

    const c = new PayPalConnector({
      oauthOverrides: { config: SANDBOX_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C_test', state: 'st', context: ctx });
    expect(result.metadata?.name).toBe('owner@demo-restaurant.example');
  });

  it('returns ok=false when token exchange returns 401 (invalid client)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        error: 'invalid_client',
        error_description: 'Client Authentication failed',
      })
    );
    const c = new PayPalConnector({
      oauthOverrides: { config: SANDBOX_CONFIG, fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({
      code: 'C_invalid',
      state: 'st',
      context: ctx,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expired|invalid|rejected|Client Authentication/i);
  });

  it('still succeeds when getUserInfo probe fails (best-effort enrichment)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A21_connected',
          token_type: 'Bearer',
          expires_in: 32400,
          scope: 'openid',
        })
      )
      // Probe fails → metadata falls back to env-only
      .mockResolvedValueOnce(jsonResponse(500, { name: 'INTERNAL_ERROR', message: 'oops' }));

    const c = new PayPalConnector({
      oauthOverrides: { config: SANDBOX_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C_test', state: 'st', context: ctx });
    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({ environment: 'sandbox' });
  });

  it('emits environment in metadata regardless of probe success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A21_live',
          token_type: 'Bearer',
          expires_in: 32400,
          scope: 'openid',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_USER));

    const c = new PayPalConnector({
      oauthOverrides: { config: LIVE_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C_test', state: 'st', context: ctx });
    expect(result.metadata?.environment).toBe('live');
  });

  it('exposes refresh_token on the credentials envelope', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A21_with_refresh',
          refresh_token: 'R_persisted',
          token_type: 'Bearer',
          expires_in: 32400,
          scope: 'openid',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_USER));

    const c = new PayPalConnector({
      oauthOverrides: { config: SANDBOX_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    expect(result.credentials?.refresh_token).toBe('R_persisted');
  });
});
