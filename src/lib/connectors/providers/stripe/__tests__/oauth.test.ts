import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { STRIPE_ERROR_CODES } from '@/lib/connectors/providers/stripe/errors';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getStripeOAuthConfig,
} from '@/lib/connectors/providers/stripe/oauth';

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

describe('getStripeOAuthConfig', () => {
  // Snapshot + restore env so each case starts from a known state.
  const originalClientId = process.env.STRIPE_CLIENT_ID;
  const originalSecret = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    delete process.env.STRIPE_CLIENT_ID;
    delete process.env.STRIPE_SECRET_KEY;
  });

  afterEach(() => {
    process.env.STRIPE_CLIENT_ID = originalClientId;
    process.env.STRIPE_SECRET_KEY = originalSecret;
  });

  it('returns config when both env vars set', () => {
    process.env.STRIPE_CLIENT_ID = 'ca_test_123';
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    const config = getStripeOAuthConfig();
    expect(config).toEqual({ clientId: 'ca_test_123', secretKey: 'sk_test_abc' });
  });

  it('returns null when both missing', () => {
    expect(getStripeOAuthConfig()).toBeNull();
  });

  it('returns null when only client_id missing', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    expect(getStripeOAuthConfig()).toBeNull();
  });

  it('returns null when only secret missing', () => {
    process.env.STRIPE_CLIENT_ID = 'ca_test_123';
    expect(getStripeOAuthConfig()).toBeNull();
  });

  it('trims surrounding whitespace from values', () => {
    process.env.STRIPE_CLIENT_ID = '  ca_test_123  ';
    process.env.STRIPE_SECRET_KEY = '\tsk_test_abc\n';
    expect(getStripeOAuthConfig()).toEqual({
      clientId: 'ca_test_123',
      secretKey: 'sk_test_abc',
    });
  });

  it('treats whitespace-only values as missing', () => {
    process.env.STRIPE_CLIENT_ID = '   ';
    process.env.STRIPE_SECRET_KEY = '   ';
    expect(getStripeOAuthConfig()).toBeNull();
  });
});

describe('buildAuthorizeUrl', () => {
  it('produces a well-formed URL with all required params', () => {
    const url = buildAuthorizeUrl({
      clientId: 'ca_123',
      redirectUri: 'https://app.example/callback',
      state: 'st_abc',
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://connect.stripe.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('ca_123');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example/callback');
    expect(parsed.searchParams.get('state')).toBe('st_abc');
    expect(parsed.searchParams.get('scope')).toBe('read_write');
  });

  it('URL-encodes state with special characters', () => {
    const url = buildAuthorizeUrl({
      clientId: 'ca_123',
      redirectUri: 'https://app.example/callback?providerId=stripe',
      state: 'state with spaces & ampersands=ok',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('state')).toBe('state with spaces & ampersands=ok');
    // URLSearchParams encodes spaces as `+`; that round-trips fine.
    expect(url).not.toContain('state with spaces');
  });

  it('honours an explicit read_only scope', () => {
    const url = buildAuthorizeUrl({
      clientId: 'ca_123',
      redirectUri: 'https://app.example/callback',
      state: 'st_abc',
      scope: 'read_only',
    });
    expect(new URL(url).searchParams.get('scope')).toBe('read_only');
  });

  it('emits stripe_user[email] etc. when prefill provided', () => {
    const url = buildAuthorizeUrl({
      clientId: 'ca_123',
      redirectUri: 'https://app.example/callback',
      state: 'st_abc',
      prefill: { email: 'owner@example.com', country: 'NL' },
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('stripe_user[email]')).toBe('owner@example.com');
    expect(parsed.searchParams.get('stripe_user[country]')).toBe('NL');
  });
});

describe('exchangeCodeForToken', () => {
  it('returns parsed token response on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: 'sk_test_connected',
        refresh_token: 'rt_test_xyz',
        stripe_user_id: 'acct_1ABC',
        stripe_publishable_key: 'pk_test_pub',
        scope: 'read_write',
        livemode: false,
        token_type: 'bearer',
      })
    );
    const tokens = await exchangeCodeForToken({
      code: 'ac_test_code',
      secretKey: 'sk_test_platform',
      fetchImpl,
    });
    expect(tokens.access_token).toBe('sk_test_connected');
    expect(tokens.stripe_user_id).toBe('acct_1ABC');
    expect(tokens.livemode).toBe(false);
    // Body must be form-urlencoded, not JSON.
    const call = fetchImpl.mock.calls[0]!;
    expect(call[1]?.headers?.['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(call[1]?.body as string).toContain('client_secret=sk_test_platform');
    expect(call[1]?.body as string).toContain('code=ac_test_code');
    expect(call[1]?.body as string).toContain('grant_type=authorization_code');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        error: 'invalid_client',
        error_description: 'Invalid platform secret key',
      })
    );
    await expect(
      exchangeCodeForToken({ code: 'ac_x', secretKey: 'sk_bad', fetchImpl })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('maps invalid_grant 400 → VALIDATION_FAILED ConnectorError', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(400, {
        error: 'invalid_grant',
        error_description: 'Authorization code already redeemed',
      })
    );
    await expect(
      exchangeCodeForToken({ code: 'ac_used', secretKey: 'sk_test_platform', fetchImpl })
    ).rejects.toMatchObject({
      code: STRIPE_ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it('throws when response is missing required fields (rogue proxy)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, { foo: 'bar' }));
    await expect(
      exchangeCodeForToken({ code: 'ac_x', secretKey: 'sk_test', fetchImpl })
    ).rejects.toBeInstanceOf(ConnectorError);
  });

  it('wraps fetch failures as NETWORK_ERROR', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(
      exchangeCodeForToken({ code: 'ac_x', secretKey: 'sk_test', fetchImpl })
    ).rejects.toMatchObject({
      code: STRIPE_ERROR_CODES.NETWORK_ERROR,
    });
  });
});
