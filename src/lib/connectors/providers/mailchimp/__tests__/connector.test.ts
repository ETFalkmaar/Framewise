import { describe, expect, it, vi } from 'vitest';
import { MailchimpConnector } from '@/lib/connectors/providers/mailchimp/connector';
import { MAILCHIMP_ERROR_CODES } from '@/lib/connectors/providers/mailchimp/errors';
import type { MailchimpAccount } from '@/lib/connectors/providers/mailchimp/types';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';

const TEST_CONFIG = {
  clientId: 'mc_cid_test',
  clientSecret: 'mc_secret_test',
};

const SAMPLE_METADATA = {
  dc: 'us1',
  role: 'owner',
  accountname: 'Demo Account',
  user_id: 12345,
  login: {
    email: 'demo@framewise-test.example',
    avatar: null,
    login_id: 67890,
    login_name: 'Demo Owner',
    login_email: 'demo@framewise-test.example',
  },
  login_url: 'https://login.mailchimp.com',
  api_endpoint: 'https://us1.api.mailchimp.com',
};

const FREE_ACCOUNT: MailchimpAccount = {
  account_id: 'abc123',
  login_id: 'login_xyz',
  account_name: 'Demo Restaurant Amsterdam B.V.',
  email: 'owner@demo-restaurant.example',
  first_name: 'Demo',
  last_name: 'Owner',
  username: 'demo-owner',
  role: 'owner',
  member_since: '2024-01-01T00:00:00Z',
  pricing_plan_type: 'forever_free',
  account_timezone: 'Europe/Amsterdam',
  last_login: '2026-05-10T00:00:00Z',
  total_subscribers: 250,
};

const PAID_ACCOUNT: MailchimpAccount = {
  ...FREE_ACCOUNT,
  pricing_plan_type: 'monthly',
  total_subscribers: 50_000,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ctx = { tenantId: VILLA, userId: SUPER };

describe('MailchimpConnector definition', () => {
  it('declares the correct identity', () => {
    const c = new MailchimpConnector();
    expect(c.id).toBe('mailchimp');
    expect(c.category).toBe('newsletter');
    expect(c.authMethod).toBe('oauth');
    expect(c.availableIn).toEqual(['NL', 'CW']);
    // Mailchimp doesn't use scopes — empty array.
    expect(c.oauth?.scopes).toEqual([]);
    expect(c.oauth?.requiresClientSecret).toBe(true);
    expect(c.oauth?.pkce).toBe(false);
  });

  it('hasConfig() reflects the override', () => {
    const withConfig = new MailchimpConnector({ oauthOverrides: { config: TEST_CONFIG } });
    const withoutConfig = new MailchimpConnector({ oauthOverrides: { config: null } });
    expect(withConfig.hasConfig()).toBe(true);
    expect(withoutConfig.hasConfig()).toBe(false);
  });
});

describe('MailchimpConnector.getAuthorizeUrl', () => {
  it('returns a valid URL with state, no scope param', async () => {
    const c = new MailchimpConnector({ oauthOverrides: { config: TEST_CONFIG } });
    const url = await c.getAuthorizeUrl({
      state: 'st_abc',
      callbackUrl: 'https://app.example/api/connectors/oauth/callback?providerId=mailchimp',
    });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('login.mailchimp.com');
    expect(parsed.pathname).toBe('/oauth2/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('mc_cid_test');
    expect(parsed.searchParams.get('state')).toBe('st_abc');
    expect(parsed.searchParams.has('scope')).toBe(false);
  });

  it('throws CONFIGURATION_INCOMPLETE when config missing', async () => {
    const c = new MailchimpConnector({ oauthOverrides: { config: null } });
    await expect(
      c.getAuthorizeUrl({
        state: 'st_abc',
        callbackUrl: 'https://app.example/cb',
      })
    ).rejects.toMatchObject({
      code: MAILCHIMP_ERROR_CODES.CONFIGURATION_INCOMPLETE,
    });
  });
});

describe('MailchimpConnector.handleOAuthCallback', () => {
  it('returns ok=false with clear error when config missing', async () => {
    const c = new MailchimpConnector({ oauthOverrides: { config: null } });
    const result = await c.handleOAuthCallback({
      code: 'C',
      state: 'st',
      context: ctx,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/configured|support/i);
  });

  it('returns ok=true with complete metadata after 3-step flow', async () => {
    // Step 1: token exchange · Step 2: metadata · Step 3: account
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'mc_access_token',
          expires_in: 0,
          scope: null,
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_METADATA))
      .mockResolvedValueOnce(jsonResponse(200, FREE_ACCOUNT));

    const c = new MailchimpConnector({
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
    expect(result.credentials?.access_token).toBe('mc_access_token');
    expect(result.credentials?.api_endpoint).toBe('https://us1.api.mailchimp.com');
    expect(result.credentials?.dc).toBe('us1');
    // Mailchimp tokens never expire — no expires_at on credentials.
    expect(result.credentials?.expires_at).toBeUndefined();
    expect(result.metadata).toMatchObject({
      account_id: 'abc123',
      account_name: 'Demo Restaurant Amsterdam B.V.',
      email: 'owner@demo-restaurant.example',
      login_email: 'demo@framewise-test.example',
      full_name: 'Demo Owner',
      dc: 'us1',
      api_endpoint: 'https://us1.api.mailchimp.com',
      pricing_plan_type: 'forever_free',
      total_subscribers: 250,
      is_free_tier: true,
      account_timezone: 'Europe/Amsterdam',
    });

    // Confirm 3 fetches happened in the right order.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://login.mailchimp.com/oauth2/token');
    expect(fetchImpl.mock.calls[1]![0]).toBe('https://login.mailchimp.com/oauth2/metadata');
    expect(fetchImpl.mock.calls[2]![0]).toBe('https://us1.api.mailchimp.com/3.0/');
  });

  it('sets is_free_tier=false for paid pricing_plan_type', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: 'mc_token', expires_in: 0, scope: null })
      )
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_METADATA))
      .mockResolvedValueOnce(jsonResponse(200, PAID_ACCOUNT));
    const c = new MailchimpConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    expect(result.metadata?.pricing_plan_type).toBe('monthly');
    expect(result.metadata?.is_free_tier).toBe(false);
  });

  it('uses the region-specific api_endpoint from metadata for the account fetch', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: 'mc_token', expires_in: 0, scope: null })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ...SAMPLE_METADATA,
          dc: 'eu1',
          api_endpoint: 'https://eu1.api.mailchimp.com',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, FREE_ACCOUNT));
    const c = new MailchimpConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    // 3rd fetch must hit the EU host, not US.
    expect(fetchImpl.mock.calls[2]![0]).toBe('https://eu1.api.mailchimp.com/3.0/');
  });

  it('returns ok=false when token exchange returns 401 (invalid credentials)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        error: 'invalid_client',
        error_description: 'Authentication failed',
      })
    );
    const c = new MailchimpConnector({
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

  it('returns ok=false when metadata fetch returns 401 (revoked token)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: 'mc_token', expires_in: 0, scope: null })
      )
      .mockResolvedValueOnce(
        jsonResponse(401, { title: 'Unauthorized', detail: 'Access token revoked' })
      );
    const c = new MailchimpConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({
      code: 'C',
      state: 'st',
      context: ctx,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/revoked|invalid|expired/i);
  });

  it('still succeeds when /3.0/ probe fails (best-effort enrichment, falls back to metadata-only)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: 'mc_token', expires_in: 0, scope: null })
      )
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_METADATA))
      .mockResolvedValueOnce(jsonResponse(500, { title: 'oops' }));

    const c = new MailchimpConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    expect(result.ok).toBe(true);
    // We still surface dc + api_endpoint + accountname + login_email from
    // the metadata endpoint — the rich account info from /3.0/ is missing.
    expect(result.metadata?.dc).toBe('us1');
    expect(result.metadata?.api_endpoint).toBe('https://us1.api.mailchimp.com');
    expect(result.metadata?.account_name).toBe('Demo Account');
    expect(result.metadata?.login_email).toBe('demo@framewise-test.example');
    expect(result.metadata?.account_id).toBeUndefined();
    expect(result.metadata?.is_free_tier).toBeUndefined();
  });

  it('persists access_token + api_endpoint + dc on the credentials envelope', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: 'mc_persisted', expires_in: 0, scope: null })
      )
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_METADATA))
      .mockResolvedValueOnce(jsonResponse(200, FREE_ACCOUNT));
    const c = new MailchimpConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    await c.getAuthorizeUrl({ state: 'st', callbackUrl: 'https://app.example/cb' });
    const result = await c.handleOAuthCallback({ code: 'C', state: 'st', context: ctx });
    expect(result.credentials).toEqual({
      access_token: 'mc_persisted',
      api_endpoint: 'https://us1.api.mailchimp.com',
      dc: 'us1',
    });
  });
});
