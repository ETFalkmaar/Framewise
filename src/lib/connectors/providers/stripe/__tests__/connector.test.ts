import { describe, expect, it, vi } from 'vitest';
import { StripeConnector } from '@/lib/connectors/providers/stripe/connector';
import { STRIPE_ERROR_CODES } from '@/lib/connectors/providers/stripe/errors';
import type { StripeAccount } from '@/lib/connectors/providers/stripe/types';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';

const TEST_CONFIG = { clientId: 'ca_test_xxx', secretKey: 'sk_test_platform' };

const SAMPLE_ACCOUNT: StripeAccount = {
  id: 'acct_1ABC',
  business_profile: {
    name: 'Demo Restaurant Amsterdam B.V.',
    url: null,
    support_email: null,
  },
  country: 'NL',
  default_currency: 'eur',
  email: 'owner@demo-restaurant.example',
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ctx = { tenantId: VILLA, userId: SUPER };

describe('StripeConnector definition', () => {
  it('declares the correct identity', () => {
    const c = new StripeConnector();
    expect(c.id).toBe('stripe');
    expect(c.category).toBe('payments');
    expect(c.authMethod).toBe('oauth');
    expect(c.availableIn).toEqual(['NL', 'CW']);
    expect(c.oauth?.scopes).toEqual(['read_write']);
    expect(c.oauth?.requiresClientSecret).toBe(true);
    expect(c.oauth?.pkce).toBe(false);
  });

  it('hasConfig() reflects the override', () => {
    const withConfig = new StripeConnector({ oauthOverrides: { config: TEST_CONFIG } });
    const withoutConfig = new StripeConnector({ oauthOverrides: { config: null } });
    expect(withConfig.hasConfig()).toBe(true);
    expect(withoutConfig.hasConfig()).toBe(false);
  });
});

describe('StripeConnector.getAuthorizeUrl', () => {
  it('returns valid URL with state + scope when config present', async () => {
    const c = new StripeConnector({ oauthOverrides: { config: TEST_CONFIG } });
    const url = await c.getAuthorizeUrl({
      state: 'st_abc',
      callbackUrl: 'https://app.example/api/connectors/oauth/callback?providerId=stripe',
    });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('connect.stripe.com');
    expect(parsed.searchParams.get('client_id')).toBe('ca_test_xxx');
    expect(parsed.searchParams.get('state')).toBe('st_abc');
    expect(parsed.searchParams.get('scope')).toBe('read_write');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://app.example/api/connectors/oauth/callback?providerId=stripe'
    );
  });

  it('throws CONFIGURATION_INCOMPLETE when config missing', async () => {
    const c = new StripeConnector({ oauthOverrides: { config: null } });
    await expect(
      c.getAuthorizeUrl({
        state: 'st_abc',
        callbackUrl: 'https://app.example/cb',
      })
    ).rejects.toMatchObject({
      code: STRIPE_ERROR_CODES.CONFIGURATION_INCOMPLETE,
    });
  });
});

describe('StripeConnector.handleOAuthCallback', () => {
  it('returns ok=false with clear error when config missing', async () => {
    const c = new StripeConnector({ oauthOverrides: { config: null } });
    const result = await c.handleOAuthCallback({
      code: 'ac_test',
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
          access_token: 'sk_test_connected',
          refresh_token: 'rt_test_xyz',
          stripe_user_id: 'acct_1ABC',
          stripe_publishable_key: 'pk_test_pub',
          scope: 'read_write',
          livemode: false,
          token_type: 'bearer',
        })
      )
      // 2nd call: getAccount probe
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));

    const c = new StripeConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    const result = await c.handleOAuthCallback({
      code: 'ac_test',
      state: 'st_abc',
      context: ctx,
    });

    expect(result.ok).toBe(true);
    expect(result.credentials?.access_token).toBe('sk_test_connected');
    expect(result.credentials?.stripe_user_id).toBe('acct_1ABC');
    expect(result.credentials?.refresh_token).toBe('rt_test_xyz');
    expect(result.metadata).toEqual({
      stripe_user_id: 'acct_1ABC',
      account_country: 'NL',
      account_currency: 'eur',
      business_name: 'Demo Restaurant Amsterdam B.V.',
      livemode: false,
      charges_enabled: true,
      payouts_enabled: true,
    });
  });

  it('falls back to email when business_profile.name is null', async () => {
    const account = {
      ...SAMPLE_ACCOUNT,
      business_profile: { name: null, url: null, support_email: null },
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'sk_test_connected',
          stripe_user_id: 'acct_1ABC',
          stripe_publishable_key: 'pk_test_pub',
          scope: 'read_write',
          livemode: true,
          token_type: 'bearer',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, account));

    const c = new StripeConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    const result = await c.handleOAuthCallback({
      code: 'ac_test',
      state: 'st_abc',
      context: ctx,
    });
    expect(result.metadata?.business_name).toBe('owner@demo-restaurant.example');
    expect(result.metadata?.livemode).toBe(true);
  });

  it('returns ok=false when token exchange returns 401 (invalid code)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        error: 'invalid_grant',
        error_description: 'platform secret rejected',
      })
    );
    const c = new StripeConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
    });
    const result = await c.handleOAuthCallback({
      code: 'ac_invalid',
      state: 'st_abc',
      context: ctx,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/rejected|secret|invalid/i);
  });

  it('still succeeds when getAccount probe fails (best-effort enrichment)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'sk_test_connected',
          stripe_user_id: 'acct_1ABC',
          stripe_publishable_key: 'pk_test_pub',
          scope: 'read_write',
          livemode: false,
          token_type: 'bearer',
        })
      )
      // Probe fails → metadata falls back to minimal shape
      .mockResolvedValueOnce(jsonResponse(500, { error: { message: 'oops' } }));

    const c = new StripeConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    const result = await c.handleOAuthCallback({
      code: 'ac_test',
      state: 'st_abc',
      context: ctx,
    });
    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      stripe_user_id: 'acct_1ABC',
      livemode: false,
    });
  });

  it('emits livemode in metadata regardless of probe success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'sk_test_connected',
          stripe_user_id: 'acct_1ABC',
          stripe_publishable_key: 'pk_test_pub',
          scope: 'read_write',
          livemode: true,
          token_type: 'bearer',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));

    const c = new StripeConnector({
      oauthOverrides: { config: TEST_CONFIG, fetchImpl },
      clientOverrides: { fetchImpl },
    });
    const result = await c.handleOAuthCallback({
      code: 'ac_test',
      state: 'st_abc',
      context: ctx,
    });
    expect(result.metadata?.livemode).toBe(true);
    expect(result.metadata?.charges_enabled).toBe(true);
    expect(result.metadata?.payouts_enabled).toBe(true);
  });
});
