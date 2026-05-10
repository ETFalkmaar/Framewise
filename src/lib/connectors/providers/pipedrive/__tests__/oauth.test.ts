import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { PIPEDRIVE_ERROR_CODES } from '@/lib/connectors/providers/pipedrive/errors';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getPipedriveOAuthConfig,
} from '@/lib/connectors/providers/pipedrive/oauth';

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

describe('getPipedriveOAuthConfig', () => {
  const originalClientId = process.env.PIPEDRIVE_CLIENT_ID;
  const originalSecret = process.env.PIPEDRIVE_CLIENT_SECRET;

  beforeEach(() => {
    delete process.env.PIPEDRIVE_CLIENT_ID;
    delete process.env.PIPEDRIVE_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env.PIPEDRIVE_CLIENT_ID = originalClientId;
    process.env.PIPEDRIVE_CLIENT_SECRET = originalSecret;
  });

  it('returns config when both env vars set', () => {
    process.env.PIPEDRIVE_CLIENT_ID = 'pipe_cid_test';
    process.env.PIPEDRIVE_CLIENT_SECRET = 'pipe_secret_test';
    expect(getPipedriveOAuthConfig()).toEqual({
      clientId: 'pipe_cid_test',
      clientSecret: 'pipe_secret_test',
    });
  });

  it('returns null when both missing', () => {
    expect(getPipedriveOAuthConfig()).toBeNull();
  });

  it('returns null when only client_id missing', () => {
    process.env.PIPEDRIVE_CLIENT_SECRET = 'pipe_secret_test';
    expect(getPipedriveOAuthConfig()).toBeNull();
  });

  it('returns null when only secret missing', () => {
    process.env.PIPEDRIVE_CLIENT_ID = 'pipe_cid_test';
    expect(getPipedriveOAuthConfig()).toBeNull();
  });

  it('treats whitespace-only values as missing', () => {
    process.env.PIPEDRIVE_CLIENT_ID = '   ';
    process.env.PIPEDRIVE_CLIENT_SECRET = '   ';
    expect(getPipedriveOAuthConfig()).toBeNull();
  });

  it('trims surrounding whitespace from values', () => {
    process.env.PIPEDRIVE_CLIENT_ID = '  pipe_cid  ';
    process.env.PIPEDRIVE_CLIENT_SECRET = '\tpipe_secret\n';
    expect(getPipedriveOAuthConfig()).toEqual({
      clientId: 'pipe_cid',
      clientSecret: 'pipe_secret',
    });
  });
});

describe('buildAuthorizeUrl', () => {
  it('produces a well-formed URL with all required params', () => {
    const url = buildAuthorizeUrl({
      clientId: 'pipe_cid_123',
      redirectUri: 'https://app.example/callback',
      state: 'st_abc',
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://oauth.pipedrive.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('pipe_cid_123');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example/callback');
    expect(parsed.searchParams.get('state')).toBe('st_abc');
  });

  it('does NOT include a scope query param (Pipedrive specific)', () => {
    // Pipedrive's OAuth flow uses scopes configured in the app
    // registration, not in the authorize URL. A future "helpful"
    // edit might be tempted to add `scope` — this test guards.
    const url = buildAuthorizeUrl({
      clientId: 'pipe_cid_123',
      redirectUri: 'https://app.example/cb',
      state: 'st',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.has('scope')).toBe(false);
  });

  it('URL-encodes state with special characters', () => {
    const url = buildAuthorizeUrl({
      clientId: 'pipe_cid_123',
      redirectUri: 'https://app.example/cb?providerId=pipedrive',
      state: 'state with spaces & ampersands=ok',
    });
    expect(new URL(url).searchParams.get('state')).toBe('state with spaces & ampersands=ok');
  });
});

describe('exchangeCodeForToken', () => {
  it('returns parsed token response on success and uses Basic auth', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: 'pipe_access_token',
        refresh_token: 'pipe_refresh_token',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'base contacts:read contacts:full',
        api_domain: 'https://framewise-test.pipedrive.com',
      })
    );
    const tokens = await exchangeCodeForToken({
      code: 'auth_code_xyz',
      clientId: 'pipe_cid',
      clientSecret: 'pipe_secret',
      redirectUri: 'https://app.example/cb',
      fetchImpl,
    });
    expect(tokens.access_token).toBe('pipe_access_token');
    expect(tokens.refresh_token).toBe('pipe_refresh_token');
    expect(tokens.api_domain).toBe('https://framewise-test.pipedrive.com');

    const call = fetchImpl.mock.calls[0]!;
    expect(call[0]).toBe('https://oauth.pipedrive.com/oauth/token');
    // Basic auth header with base64-encoded credentials.
    const authHeader = (call[1]?.headers as Record<string, string>).Authorization;
    expect(authHeader).toMatch(/^Basic /);
    const decoded = Buffer.from(authHeader.replace(/^Basic /, ''), 'base64').toString('utf8');
    expect(decoded).toBe('pipe_cid:pipe_secret');
    // Form-urlencoded body — only 3 fields (no client_id/secret in body).
    expect((call[1]?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded'
    );
    const body = call[1]?.body as string;
    expect(body).toContain('grant_type=authorization_code');
    expect(body).toContain('code=auth_code_xyz');
    expect(body).toContain('redirect_uri=');
    expect(body).not.toContain('client_id=');
    expect(body).not.toContain('client_secret=');
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
        clientId: 'pipe_bad',
        clientSecret: 'pipe_bad',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws when refresh_token missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: 'present',
        token_type: 'bearer',
        expires_in: 3600,
        api_domain: 'https://x.pipedrive.com',
      })
    );
    await expect(
      exchangeCodeForToken({
        code: 'auth_code',
        clientId: 'pipe_cid',
        clientSecret: 'pipe_secret',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toMatchObject({ code: PIPEDRIVE_ERROR_CODES.NETWORK_ERROR });
  });

  it('throws when api_domain missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: 'present',
        refresh_token: 'present',
        token_type: 'bearer',
        expires_in: 3600,
      })
    );
    await expect(
      exchangeCodeForToken({
        code: 'auth_code',
        clientId: 'pipe_cid',
        clientSecret: 'pipe_secret',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toMatchObject({ code: PIPEDRIVE_ERROR_CODES.NETWORK_ERROR });
  });

  it('maps invalid_grant 400 to VALIDATION_FAILED ConnectorError', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(400, {
        error: 'invalid_grant',
        error_description: 'Authorization code already redeemed',
      })
    );
    await expect(
      exchangeCodeForToken({
        code: 'auth_code_used',
        clientId: 'pipe_cid',
        clientSecret: 'pipe_secret',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toMatchObject({
      code: PIPEDRIVE_ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it('wraps fetch failures as NETWORK_ERROR', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(
      exchangeCodeForToken({
        code: 'auth_code',
        clientId: 'pipe_cid',
        clientSecret: 'pipe_secret',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toMatchObject({ code: PIPEDRIVE_ERROR_CODES.NETWORK_ERROR });
  });

  it('throws connector error wrapper on 5xx', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(500, { error_info: 'Pipedrive temporarily unavailable' })
      );
    await expect(
      exchangeCodeForToken({
        code: 'auth_code',
        clientId: 'pipe_cid',
        clientSecret: 'pipe_secret',
        redirectUri: 'https://app.example/cb',
        fetchImpl,
      })
    ).rejects.toBeInstanceOf(ConnectorError);
  });
});
