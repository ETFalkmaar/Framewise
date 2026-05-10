import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { PAYPAL_ERROR_CODES } from '@/lib/connectors/providers/paypal/errors';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getPayPalOAuthConfig,
} from '@/lib/connectors/providers/paypal/oauth';

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

describe('getPayPalOAuthConfig', () => {
  const originalClientId = process.env.PAYPAL_CLIENT_ID;
  const originalSecret = process.env.PAYPAL_CLIENT_SECRET;
  const originalEnv = process.env.PAYPAL_ENVIRONMENT;

  beforeEach(() => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.PAYPAL_ENVIRONMENT;
  });

  afterEach(() => {
    process.env.PAYPAL_CLIENT_ID = originalClientId;
    process.env.PAYPAL_CLIENT_SECRET = originalSecret;
    process.env.PAYPAL_ENVIRONMENT = originalEnv;
  });

  it('returns config with environment when both env vars set', () => {
    process.env.PAYPAL_CLIENT_ID = 'AY_test_client';
    process.env.PAYPAL_CLIENT_SECRET = 'EL_test_secret';
    const config = getPayPalOAuthConfig();
    expect(config).toEqual({
      clientId: 'AY_test_client',
      clientSecret: 'EL_test_secret',
      environment: 'sandbox',
    });
  });

  it('honours PAYPAL_ENVIRONMENT=live', () => {
    process.env.PAYPAL_CLIENT_ID = 'AY_live';
    process.env.PAYPAL_CLIENT_SECRET = 'EL_live';
    process.env.PAYPAL_ENVIRONMENT = 'live';
    expect(getPayPalOAuthConfig()).toEqual({
      clientId: 'AY_live',
      clientSecret: 'EL_live',
      environment: 'live',
    });
  });

  it('returns null when both missing', () => {
    expect(getPayPalOAuthConfig()).toBeNull();
  });

  it('returns null when only client_id missing', () => {
    process.env.PAYPAL_CLIENT_SECRET = 'EL_test_secret';
    expect(getPayPalOAuthConfig()).toBeNull();
  });

  it('returns null when only secret missing', () => {
    process.env.PAYPAL_CLIENT_ID = 'AY_test_client';
    expect(getPayPalOAuthConfig()).toBeNull();
  });

  it('treats whitespace-only values as missing', () => {
    process.env.PAYPAL_CLIENT_ID = '   ';
    process.env.PAYPAL_CLIENT_SECRET = '   ';
    expect(getPayPalOAuthConfig()).toBeNull();
  });

  it('trims surrounding whitespace from values', () => {
    process.env.PAYPAL_CLIENT_ID = '  AY_test  ';
    process.env.PAYPAL_CLIENT_SECRET = '\tEL_test\n';
    expect(getPayPalOAuthConfig()).toEqual({
      clientId: 'AY_test',
      clientSecret: 'EL_test',
      environment: 'sandbox',
    });
  });
});

describe('buildAuthorizeUrl', () => {
  it('produces a sandbox URL with all required params', () => {
    const url = buildAuthorizeUrl({
      clientId: 'AY_123',
      redirectUri: 'https://app.example/callback',
      state: 'st_abc',
      environment: 'sandbox',
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://www.sandbox.paypal.com');
    expect(parsed.pathname).toBe('/connect');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('AY_123');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example/callback');
    expect(parsed.searchParams.get('state')).toBe('st_abc');
  });

  it('produces a live URL when environment is live', () => {
    const url = buildAuthorizeUrl({
      clientId: 'AY_123',
      redirectUri: 'https://app.example/callback',
      state: 'st_abc',
      environment: 'live',
    });
    expect(new URL(url).origin).toBe('https://www.paypal.com');
  });

  it('joins default scopes with spaces (rendered as +)', () => {
    const url = buildAuthorizeUrl({
      clientId: 'AY_123',
      redirectUri: 'https://app.example/cb',
      state: 'st',
      environment: 'sandbox',
    });
    const scope = new URL(url).searchParams.get('scope');
    expect(scope).toContain('openid');
    expect(scope).toContain('profile');
    expect(scope).toContain('email');
    expect(scope).toContain('https://uri.paypal.com/services/paypalattributes');
    // URLSearchParams encodes spaces as `+`.
    expect(url).toMatch(/scope=openid\+profile/);
  });

  it('honours an explicit minimal scope set', () => {
    const url = buildAuthorizeUrl({
      clientId: 'AY_123',
      redirectUri: 'https://app.example/cb',
      state: 'st',
      environment: 'sandbox',
      scopes: ['openid'],
    });
    expect(new URL(url).searchParams.get('scope')).toBe('openid');
  });
});

describe('exchangeCodeForToken', () => {
  it('returns parsed token response on success and uses Basic auth', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: 'A21AAA_test_token',
        refresh_token: 'R23000_refresh',
        token_type: 'Bearer',
        expires_in: 32400,
        scope: 'openid profile email',
      })
    );
    const tokens = await exchangeCodeForToken({
      code: 'C21AAA_code',
      clientId: 'AY_client',
      clientSecret: 'EL_secret',
      redirectUri: 'https://app.example/cb',
      environment: 'sandbox',
      fetchImpl,
    });
    expect(tokens.access_token).toBe('A21AAA_test_token');
    expect(tokens.refresh_token).toBe('R23000_refresh');
    expect(tokens.expires_in).toBe(32400);

    const call = fetchImpl.mock.calls[0]!;
    // URL must be the sandbox token endpoint.
    expect(call[0]).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
    // Basic auth header with base64-encoded credentials.
    const authHeader = (call[1]?.headers as Record<string, string>).Authorization;
    expect(authHeader).toMatch(/^Basic /);
    const decoded = Buffer.from(authHeader.replace(/^Basic /, ''), 'base64').toString('utf8');
    expect(decoded).toBe('AY_client:EL_secret');
    // Form-urlencoded body.
    expect((call[1]?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded'
    );
    expect(call[1]?.body as string).toContain('grant_type=authorization_code');
    expect(call[1]?.body as string).toContain('code=C21AAA_code');
    expect(call[1]?.body as string).toContain('redirect_uri=');
  });

  it('hits the live token endpoint when environment is live', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: 'live_token',
        token_type: 'Bearer',
        expires_in: 32400,
        scope: 'openid',
      })
    );
    await exchangeCodeForToken({
      code: 'C_live',
      clientId: 'AY_l',
      clientSecret: 'EL_l',
      redirectUri: 'https://app.example/cb',
      environment: 'live',
      fetchImpl,
    });
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api-m.paypal.com/v1/oauth2/token');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        error: 'invalid_client',
        error_description: 'Client Authentication failed',
      })
    );
    await expect(
      exchangeCodeForToken({
        code: 'C',
        clientId: 'AY_bad',
        clientSecret: 'EL_bad',
        redirectUri: 'https://app.example/cb',
        environment: 'sandbox',
        fetchImpl,
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('maps invalid_grant 400 to VALIDATION_FAILED ConnectorError', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(400, {
        error: 'invalid_grant',
        error_description: 'Authorization code expired',
      })
    );
    await expect(
      exchangeCodeForToken({
        code: 'C_used',
        clientId: 'AY_c',
        clientSecret: 'EL_c',
        redirectUri: 'https://app.example/cb',
        environment: 'sandbox',
        fetchImpl,
      })
    ).rejects.toMatchObject({
      code: PAYPAL_ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it('throws when access_token missing (rogue proxy)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, { foo: 'bar' }));
    await expect(
      exchangeCodeForToken({
        code: 'C',
        clientId: 'AY_c',
        clientSecret: 'EL_c',
        redirectUri: 'https://app.example/cb',
        environment: 'sandbox',
        fetchImpl,
      })
    ).rejects.toBeInstanceOf(ConnectorError);
  });

  it('wraps fetch failures as NETWORK_ERROR', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(
      exchangeCodeForToken({
        code: 'C',
        clientId: 'AY_c',
        clientSecret: 'EL_c',
        redirectUri: 'https://app.example/cb',
        environment: 'sandbox',
        fetchImpl,
      })
    ).rejects.toMatchObject({
      code: PAYPAL_ERROR_CODES.NETWORK_ERROR,
    });
  });
});
