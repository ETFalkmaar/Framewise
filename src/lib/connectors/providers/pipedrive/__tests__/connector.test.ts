import { describe, expect, it, vi } from 'vitest';
import { PipedriveConnector } from '@/lib/connectors/providers/pipedrive/connector';
import { PIPEDRIVE_ERROR_CODES } from '@/lib/connectors/providers/pipedrive/errors';
import type { PipedriveUser } from '@/lib/connectors/providers/pipedrive/types';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';

const TEST_CONFIG = {
  clientId: 'pipe_cid_test',
  clientSecret: 'pipe_secret_test',
};

const SAMPLE_USER: PipedriveUser = {
  id: 12345,
  name: 'Demo User',
  email: 'demo@framewise-test.example',
  default_currency: 'EUR',
  locale: 'en_GB',
  lang: 1,
  language: { language_code: 'en', country_code: 'NL' },
  timezone_name: 'Europe/Amsterdam',
  company_id: 67890,
  company_name: 'Demo Restaurant Amsterdam B.V.',
  company_domain: 'demo-restaurant',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ctx = { tenantId: VILLA, userId: SUPER };

describe('PipedriveConnector definition', () => {
  it('declares the correct identity', () => {
    const c = new PipedriveConnector();
    expect(c.id).toBe('pipedrive');
    expect(c.category).toBe('crm');
    expect(c.authMethod).toBe('oauth');
    expect(c.availableIn).toEqual(['NL', 'CW']);
    expect(c.oauth?.scopes).toEqual(['base', 'contacts:read', 'contacts:full']);
    expect(c.oauth?.requiresClientSecret).toBe(true);
    expect(c.oauth?.pkce).toBe(false);
  });

  it('hasConfig() reflects the override', () => {
    const withConfig = new PipedriveConnector({ oauthOverrides: { config: TEST_CONFIG } });
    const withoutConfig = new PipedriveConnector({ oauthOverrides: { config: null } });
    expect(withConfig.hasConfig()).toBe(true);
    expect(withoutConfig.hasConfig()).toBe(false);
  });
});

describe('PipedriveConnector.getAuthorizeUrl', () => {
  it('returns a valid URL with state when config present', async () => {
    const c = new PipedriveConnector({ oauthOverrides: { config: TEST_CONFIG } });
    const url = await c.getAuthorizeUrl({
      state: 'st_abc',
      callbackUrl: 'https://app.example/api/connectors/oauth/callback?providerId=pipedrive',
    });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('oauth.pipedrive.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('pipe_cid_test');
    expect(parsed.searchParams.get('state')).toBe('st_abc');
    // Pipedrive specifically does NOT take a scope param.
    expect(parsed.searchParams.has('scope')).toBe(false);
  });

  it('caches the redirect URI for callback echo-back', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A',
          refresh_token: 'R',
          token_type: 'bearer',
          expires_in: 3600,
          scope: 'base',
          api_domain: 'https://demo.pipedrive.com',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: SAMPLE_USER }));
    const c = new PipedriveConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({
      state: 'st',
      callbackUrl: 'https://app.example/cb-cached',
    });
    await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    expect(fetchImpl.mock.calls[0]![1]?.body as string).toContain(
      'redirect_uri=https%3A%2F%2Fapp.example%2Fcb-cached'
    );
  });

  it('throws CONFIGURATION_INCOMPLETE when config missing', async () => {
    const c = new PipedriveConnector({ oauthOverrides: { config: null } });
    await expect(
      c.getAuthorizeUrl({
        state: 'st_abc',
        callbackUrl: 'https://app.example/cb',
      })
    ).rejects.toMatchObject({
      code: PIPEDRIVE_ERROR_CODES.CONFIGURATION_INCOMPLETE,
    });
  });
});

describe('PipedriveConnector.handleOAuthCallback', () => {
  it('returns ok=false with clear error when config missing', async () => {
    const c = new PipedriveConnector({ oauthOverrides: { config: null } });
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
          access_token: 'pipe_access',
          refresh_token: 'pipe_refresh',
          token_type: 'bearer',
          expires_in: 3600,
          scope: 'base contacts:read contacts:full',
          api_domain: 'https://demo-restaurant.pipedrive.com',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: SAMPLE_USER }));

    const c = new PipedriveConnector({
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
    expect(result.credentials?.access_token).toBe('pipe_access');
    expect(result.credentials?.refresh_token).toBe('pipe_refresh');
    expect(result.credentials?.api_domain).toBe('https://demo-restaurant.pipedrive.com');
    expect(result.credentials?.expires_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(result.metadata).toMatchObject({
      user_id: '12345',
      user_name: 'Demo User',
      company_id: '67890',
      company_name: 'Demo Restaurant Amsterdam B.V.',
      company_domain: 'demo-restaurant',
      api_domain: 'https://demo-restaurant.pipedrive.com',
      locale: 'en',
      currency: 'EUR',
    });
  });

  it('persists company_id and user_id as strings (not numbers)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A',
          refresh_token: 'R',
          token_type: 'bearer',
          expires_in: 3600,
          scope: 'base',
          api_domain: 'https://demo.pipedrive.com',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: SAMPLE_USER }));
    const c = new PipedriveConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    expect(typeof result.metadata?.company_id).toBe('string');
    expect(typeof result.metadata?.user_id).toBe('string');
  });

  it('uses api_domain from token response for the user fetch', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A',
          refresh_token: 'R',
          token_type: 'bearer',
          expires_in: 3600,
          scope: 'base',
          api_domain: 'https://uniq-region.pipedrive.com',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: SAMPLE_USER }));
    const c = new PipedriveConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    // 2nd fetch is the /users/me probe — must hit the api_domain from the token response.
    expect(fetchImpl.mock.calls[1]![0]).toBe('https://uniq-region.pipedrive.com/api/v1/users/me');
  });

  it('returns ok=false when token exchange returns 401 (invalid credentials)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        error: 'invalid_client',
        error_description: 'Authentication failed',
      })
    );
    const c = new PipedriveConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({
      code: 'C_bad',
      state: 'st',
      context: ctx,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid|expired|rejected|Authentication/i);
  });

  it('still succeeds when getCurrentUser probe fails (best-effort enrichment)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A',
          refresh_token: 'R',
          token_type: 'bearer',
          expires_in: 3600,
          scope: 'base',
          api_domain: 'https://demo.pipedrive.com',
        })
      )
      .mockResolvedValueOnce(jsonResponse(500, { success: false, error: 'oops' }));

    const c = new PipedriveConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    expect(result.ok).toBe(true);
    // Only api_domain + expires_at are guaranteed when probe fails.
    expect(result.metadata?.api_domain).toBe('https://demo.pipedrive.com');
    expect(result.metadata?.user_id).toBeUndefined();
    expect(result.metadata?.expires_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('exposes refresh_token + api_domain + expires_at on the credentials envelope', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'A_main',
          refresh_token: 'R_persisted',
          token_type: 'bearer',
          expires_in: 3600,
          scope: 'base',
          api_domain: 'https://demo.pipedrive.com',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: SAMPLE_USER }));

    const c = new PipedriveConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    expect(result.credentials?.refresh_token).toBe('R_persisted');
    expect(result.credentials?.api_domain).toBe('https://demo.pipedrive.com');
    expect(result.credentials?.expires_at).toBeTruthy();
  });
});
