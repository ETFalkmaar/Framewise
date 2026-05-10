import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { HUBSPOT_ERROR_CODES } from '@/lib/connectors/providers/hubspot/errors';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getHubSpotOAuthConfig,
} from '@/lib/connectors/providers/hubspot/oauth';

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

describe('getHubSpotOAuthConfig', () => {
  const originalClientId = process.env.HUBSPOT_CLIENT_ID;
  const originalSecret = process.env.HUBSPOT_CLIENT_SECRET;

  beforeEach(() => {
    delete process.env.HUBSPOT_CLIENT_ID;
    delete process.env.HUBSPOT_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env.HUBSPOT_CLIENT_ID = originalClientId;
    process.env.HUBSPOT_CLIENT_SECRET = originalSecret;
  });

  it('returns config when both env vars set', () => {
    process.env.HUBSPOT_CLIENT_ID = 'cid_test';
    process.env.HUBSPOT_CLIENT_SECRET = 'csecret_test';
    expect(getHubSpotOAuthConfig()).toEqual({
      clientId: 'cid_test',
      clientSecret: 'csecret_test',
    });
  });

  it('returns null when both missing', () => {
    expect(getHubSpotOAuthConfig()).toBeNull();
  });

  it('returns null when only client_id missing', () => {
    process.env.HUBSPOT_CLIENT_SECRET = 'csecret_test';
    expect(getHubSpotOAuthConfig()).toBeNull();
  });

  it('returns null when only secret missing', () => {
    process.env.HUBSPOT_CLIENT_ID = 'cid_test';
    expect(getHubSpotOAuthConfig()).toBeNull();
  });

  it('treats whitespace-only values as missing', () => {
    process.env.HUBSPOT_CLIENT_ID = '   ';
    process.env.HUBSPOT_CLIENT_SECRET = '   ';
    expect(getHubSpotOAuthConfig()).toBeNull();
  });

  it('trims surrounding whitespace from values', () => {
    process.env.HUBSPOT_CLIENT_ID = '  cid_test  ';
    process.env.HUBSPOT_CLIENT_SECRET = '\tcsecret_test\n';
    expect(getHubSpotOAuthConfig()).toEqual({
      clientId: 'cid_test',
      clientSecret: 'csecret_test',
    });
  });
});

describe('buildAuthorizeUrl', () => {
  it('produces a well-formed URL with all required params', () => {
    const url = buildAuthorizeUrl({
      clientId: 'cid_123',
      redirectUri: 'https://app.example/callback',
      state: 'st_abc',
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://app.hubspot.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('cid_123');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example/callback');
    expect(parsed.searchParams.get('state')).toBe('st_abc');
  });

  it('joins default scopes with spaces (rendered as +)', () => {
    const url = buildAuthorizeUrl({
      clientId: 'cid_123',
      redirectUri: 'https://app.example/cb',
      state: 'st',
    });
    const scope = new URL(url).searchParams.get('scope');
    expect(scope).toContain('oauth');
    expect(scope).toContain('crm.objects.contacts.read');
    expect(scope).toContain('crm.objects.contacts.write');
    // URLSearchParams encodes spaces as `+` (HubSpot accepts both).
    expect(url).toMatch(/scope=oauth\+/);
  });

  it('honours an explicit minimal scope set', () => {
    const url = buildAuthorizeUrl({
      clientId: 'cid_123',
      redirectUri: 'https://app.example/cb',
      state: 'st',
      scopes: ['oauth'],
    });
    expect(new URL(url).searchParams.get('scope')).toBe('oauth');
  });

  it('URL-encodes state with special characters', () => {
    const url = buildAuthorizeUrl({
      clientId: 'cid_123',
      redirectUri: 'https://app.example/cb?providerId=hubspot',
      state: 'state with spaces & ampersands=ok',
    });
    expect(new URL(url).searchParams.get('state')).toBe('state with spaces & ampersands=ok');
  });
});

describe('exchangeCodeForToken', () => {
  it('returns parsed token response on success and uses form-urlencoded body', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: 'CIo_test_access_token',
        refresh_token: 'CIo_test_refresh_token',
        token_type: 'bearer',
        expires_in: 1800,
      })
    );
    const tokens = await exchangeCodeForToken({
      code: 'auth_code_xyz',
      clientId: 'cid_test',
      clientSecret: 'csecret_test',
      redirectUri: 'https://app.example/cb',
      fetchImpl,
    });
    expect(tokens.access_token).toBe('CIo_test_access_token');
    expect(tokens.refresh_token).toBe('CIo_test_refresh_token');
    expect(tokens.expires_in).toBe(1800);

    const call = fetchImpl.mock.calls[0]!;
    expect(call[0]).toBe('https://api.hubapi.com/oauth/v1/token');
    expect((call[1]?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded'
    );
    // All five required fields in the body.
    const body = call[1]?.body as string;
    expect(body).toContain('grant_type=authorization_code');
    expect(body).toContain('client_id=cid_test');
    expect(body).toContain('client_secret=csecret_test');
    expect(body).toContain('redirect_uri=');
    expect(body).toContain('code=auth_code_xyz');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        status: 'BAD_AUTH_CODE',
        message: 'invalid client credentials',
      })
    );
    await expect(
      exchangeCodeForToken({
        code: 'auth_code',
        clientId: 'cid_bad',
        clientSecret: 'csecret_bad',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('maps BAD_AUTH_CODE 400 to VALIDATION_FAILED ConnectorError', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(400, {
        status: 'BAD_AUTH_CODE',
        message: 'authorization code already redeemed',
      })
    );
    await expect(
      exchangeCodeForToken({
        code: 'auth_code_used',
        clientId: 'cid_test',
        clientSecret: 'csecret_test',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toMatchObject({
      code: HUBSPOT_ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it('throws when refresh_token missing (rogue proxy)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: 'present',
        token_type: 'bearer',
        expires_in: 1800,
      })
    );
    await expect(
      exchangeCodeForToken({
        code: 'auth_code',
        clientId: 'cid_test',
        clientSecret: 'csecret_test',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toBeInstanceOf(ConnectorError);
  });

  it('wraps fetch failures as NETWORK_ERROR', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(
      exchangeCodeForToken({
        code: 'auth_code',
        clientId: 'cid_test',
        clientSecret: 'csecret_test',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toMatchObject({
      code: HUBSPOT_ERROR_CODES.NETWORK_ERROR,
    });
  });
});
