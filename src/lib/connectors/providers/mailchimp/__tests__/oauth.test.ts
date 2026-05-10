import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { MAILCHIMP_ERROR_CODES } from '@/lib/connectors/providers/mailchimp/errors';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchMetadata,
  getMailchimpOAuthConfig,
} from '@/lib/connectors/providers/mailchimp/oauth';

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

describe('getMailchimpOAuthConfig', () => {
  const originalClientId = process.env.MAILCHIMP_CLIENT_ID;
  const originalSecret = process.env.MAILCHIMP_CLIENT_SECRET;

  beforeEach(() => {
    delete process.env.MAILCHIMP_CLIENT_ID;
    delete process.env.MAILCHIMP_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env.MAILCHIMP_CLIENT_ID = originalClientId;
    process.env.MAILCHIMP_CLIENT_SECRET = originalSecret;
  });

  it('returns config when both env vars set', () => {
    process.env.MAILCHIMP_CLIENT_ID = 'mc_cid_test';
    process.env.MAILCHIMP_CLIENT_SECRET = 'mc_secret_test';
    expect(getMailchimpOAuthConfig()).toEqual({
      clientId: 'mc_cid_test',
      clientSecret: 'mc_secret_test',
    });
  });

  it('returns null when both missing', () => {
    expect(getMailchimpOAuthConfig()).toBeNull();
  });

  it('returns null when only client_id missing', () => {
    process.env.MAILCHIMP_CLIENT_SECRET = 'mc_secret_test';
    expect(getMailchimpOAuthConfig()).toBeNull();
  });

  it('returns null when only secret missing', () => {
    process.env.MAILCHIMP_CLIENT_ID = 'mc_cid_test';
    expect(getMailchimpOAuthConfig()).toBeNull();
  });

  it('treats whitespace-only values as missing', () => {
    process.env.MAILCHIMP_CLIENT_ID = '   ';
    process.env.MAILCHIMP_CLIENT_SECRET = '   ';
    expect(getMailchimpOAuthConfig()).toBeNull();
  });

  it('trims surrounding whitespace from values', () => {
    process.env.MAILCHIMP_CLIENT_ID = '  mc_cid  ';
    process.env.MAILCHIMP_CLIENT_SECRET = '\tmc_secret\n';
    expect(getMailchimpOAuthConfig()).toEqual({
      clientId: 'mc_cid',
      clientSecret: 'mc_secret',
    });
  });
});

describe('buildAuthorizeUrl', () => {
  it('produces a well-formed URL with all required params', () => {
    const url = buildAuthorizeUrl({
      clientId: 'mc_cid_123',
      redirectUri: 'https://app.example/callback',
      state: 'st_abc',
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://login.mailchimp.com');
    expect(parsed.pathname).toBe('/oauth2/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('mc_cid_123');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example/callback');
    expect(parsed.searchParams.get('state')).toBe('st_abc');
  });

  it('does NOT include a scope query param (Mailchimp specific)', () => {
    // Mailchimp's OAuth flow uses no scopes parameter — access is
    // governed by the connected user's own permissions. A future
    // "helpful" edit might be tempted to add `scope` — this test
    // guards.
    const url = buildAuthorizeUrl({
      clientId: 'mc_cid_123',
      redirectUri: 'https://app.example/cb',
      state: 'st',
    });
    expect(new URL(url).searchParams.has('scope')).toBe(false);
  });

  it('URL-encodes state with special characters', () => {
    const url = buildAuthorizeUrl({
      clientId: 'mc_cid_123',
      redirectUri: 'https://app.example/cb?providerId=mailchimp',
      state: 'state with spaces & ampersands=ok',
    });
    expect(new URL(url).searchParams.get('state')).toBe('state with spaces & ampersands=ok');
  });
});

describe('exchangeCodeForToken', () => {
  it('returns parsed token response on success (no refresh_token)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: 'mc_access_token',
        expires_in: 0,
        scope: null,
      })
    );
    const tokens = await exchangeCodeForToken({
      code: 'auth_code_xyz',
      clientId: 'mc_cid',
      clientSecret: 'mc_secret',
      redirectUri: 'https://app.example/cb',
      fetchImpl,
    });
    expect(tokens.access_token).toBe('mc_access_token');
    expect(tokens.expires_in).toBe(0);
    expect(tokens.scope).toBe(null);

    const call = fetchImpl.mock.calls[0]!;
    expect(call[0]).toBe('https://login.mailchimp.com/oauth2/token');
    expect((call[1]?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded'
    );
    // All five fields in the body — no Basic auth, all inline.
    const body = call[1]?.body as string;
    expect(body).toContain('grant_type=authorization_code');
    expect(body).toContain('client_id=mc_cid');
    expect(body).toContain('client_secret=mc_secret');
    expect(body).toContain('redirect_uri=');
    expect(body).toContain('code=auth_code_xyz');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        error: 'invalid_client',
        error_description: 'Authentication failed',
      })
    );
    await expect(
      exchangeCodeForToken({
        code: 'auth_code',
        clientId: 'mc_bad',
        clientSecret: 'mc_bad',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('maps invalid_grant 400 to VALIDATION_FAILED ConnectorError', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(400, {
        error: 'invalid_grant',
        error_description: 'authorization code expired',
      })
    );
    await expect(
      exchangeCodeForToken({
        code: 'auth_code_used',
        clientId: 'mc_cid',
        clientSecret: 'mc_secret',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toMatchObject({ code: MAILCHIMP_ERROR_CODES.VALIDATION_FAILED });
  });

  it('throws when access_token missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, { foo: 'bar' }));
    await expect(
      exchangeCodeForToken({
        code: 'auth_code',
        clientId: 'mc_cid',
        clientSecret: 'mc_secret',
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
        clientId: 'mc_cid',
        clientSecret: 'mc_secret',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toMatchObject({ code: MAILCHIMP_ERROR_CODES.NETWORK_ERROR });
  });

  it('defaults expires_in and scope when absent from response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'mc_token_only' }));
    const tokens = await exchangeCodeForToken({
      code: 'auth_code',
      clientId: 'mc_cid',
      clientSecret: 'mc_secret',
      redirectUri: 'https://app.example/cb',
      fetchImpl,
    });
    expect(tokens.access_token).toBe('mc_token_only');
    expect(tokens.expires_in).toBe(0);
    expect(tokens.scope).toBe(null);
  });
});

describe('fetchMetadata', () => {
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

  it('returns parsed metadata with dc + api_endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_METADATA));
    const meta = await fetchMetadata({ accessToken: 'mc_token', fetchImpl });
    expect(meta.dc).toBe('us1');
    expect(meta.api_endpoint).toBe('https://us1.api.mailchimp.com');
    expect(meta.accountname).toBe('Demo Account');
  });

  it('uses "OAuth" prefix in Authorization header (NOT Bearer)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_METADATA));
    await fetchMetadata({ accessToken: 'mc_token', fetchImpl });
    const headers = fetchImpl.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('OAuth mc_token');
    expect(headers.Authorization).not.toMatch(/^Bearer /);
  });

  it('hits the canonical metadata URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_METADATA));
    await fetchMetadata({ accessToken: 'mc_token', fetchImpl });
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://login.mailchimp.com/oauth2/metadata');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        title: 'Unauthorized',
        detail: 'Access token revoked',
      })
    );
    await expect(fetchMetadata({ accessToken: 'mc_revoked', fetchImpl })).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
  });

  it('throws NETWORK_ERROR when dc or api_endpoint missing', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ...SAMPLE_METADATA, api_endpoint: undefined }));
    await expect(fetchMetadata({ accessToken: 'mc_token', fetchImpl })).rejects.toMatchObject({
      code: MAILCHIMP_ERROR_CODES.NETWORK_ERROR,
    });
  });

  it('honours custom metadataUrl override', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_METADATA));
    await fetchMetadata({
      accessToken: 'mc_token',
      fetchImpl,
      metadataUrl: 'https://mailchimp.mock.test/oauth2/metadata',
    });
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://mailchimp.mock.test/oauth2/metadata');
  });
});
