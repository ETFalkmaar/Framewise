import { describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { PipedriveClient } from '@/lib/connectors/providers/pipedrive/client';
import { PIPEDRIVE_ERROR_CODES } from '@/lib/connectors/providers/pipedrive/errors';
import type { PipedriveUser } from '@/lib/connectors/providers/pipedrive/types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

const ENVELOPED_USER = {
  success: true,
  data: SAMPLE_USER,
  additional_data: {},
};

describe('PipedriveClient constructor', () => {
  it('throws when accessToken is empty', () => {
    expect(
      () =>
        new PipedriveClient({
          accessToken: '',
          apiDomain: 'https://x.pipedrive.com',
        })
    ).toThrow(/accessToken is required/);
  });

  it('throws when apiDomain is empty', () => {
    expect(
      () =>
        new PipedriveClient({
          accessToken: 'pipe_token',
          apiDomain: '',
        })
    ).toThrow(/apiDomain is required/);
  });

  it('accepts valid options', () => {
    expect(
      () =>
        new PipedriveClient({
          accessToken: 'pipe_token',
          apiDomain: 'https://demo.pipedrive.com',
        })
    ).not.toThrow();
  });

  it('exposes the resolved API domain', () => {
    const client = new PipedriveClient({
      accessToken: 'pipe_token',
      apiDomain: 'https://demo.pipedrive.com',
    });
    expect(client.getApiDomain()).toBe('https://demo.pipedrive.com');
  });

  it('strips trailing slash from apiDomain', () => {
    const client = new PipedriveClient({
      accessToken: 'pipe_token',
      apiDomain: 'https://demo.pipedrive.com/',
    });
    expect(client.getApiDomain()).toBe('https://demo.pipedrive.com');
  });
});

describe('PipedriveClient.getCurrentUser', () => {
  it('unwraps the data envelope and returns the parsed user', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, ENVELOPED_USER));
    const client = new PipedriveClient({
      accessToken: 'pipe_token',
      apiDomain: 'https://demo.pipedrive.com',
      fetchImpl,
    });
    const user = await client.getCurrentUser();
    expect(user.id).toBe(12345);
    expect(user.company_id).toBe(67890);
    expect(user.company_name).toBe('Demo Restaurant Amsterdam B.V.');
  });

  it('hits the region-specific /api/v1/users/me URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, ENVELOPED_USER));
    const client = new PipedriveClient({
      accessToken: 'pipe_token',
      apiDomain: 'https://demo.pipedrive.com',
      fetchImpl,
    });
    await client.getCurrentUser();
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://demo.pipedrive.com/api/v1/users/me');
  });

  it('uses a different host when apiDomain differs (region-aware)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, ENVELOPED_USER));
    const client = new PipedriveClient({
      accessToken: 'pipe_token',
      apiDomain: 'https://us-east-1.pipedrive.com',
      fetchImpl,
    });
    await client.getCurrentUser();
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://us-east-1.pipedrive.com/api/v1/users/me');
  });

  it('sends Authorization + User-Agent + Accept headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, ENVELOPED_USER));
    const client = new PipedriveClient({
      accessToken: 'pipe_token',
      apiDomain: 'https://demo.pipedrive.com',
      fetchImpl,
    });
    await client.getCurrentUser();
    const headers = fetchImpl.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer pipe_token');
    expect(headers['User-Agent']).toMatch(/Framewise/);
    expect(headers.Accept).toBe('application/json');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { success: false, error: 'Unauthorized', error_info: 'Token expired' })
      );
    const client = new PipedriveClient({
      accessToken: 'pipe_bad',
      apiDomain: 'https://demo.pipedrive.com',
      fetchImpl,
    });
    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws RATE_LIMITED ConnectorError on 429', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { success: false, error: 'Too Many Requests' }));
    const client = new PipedriveClient({
      accessToken: 'pipe_token',
      apiDomain: 'https://demo.pipedrive.com',
      fetchImpl,
    });
    await expect(client.getCurrentUser()).rejects.toMatchObject({
      code: PIPEDRIVE_ERROR_CODES.RATE_LIMITED,
    });
  });

  it('wraps AbortError as NETWORK_ERROR via pipedriveNetworkError', async () => {
    const fetchImpl = vi.fn().mockImplementationOnce(async () => {
      const e = new Error('aborted');
      (e as { name?: string }).name = 'AbortError';
      throw e;
    });
    const client = new PipedriveClient({
      accessToken: 'pipe_token',
      apiDomain: 'https://demo.pipedrive.com',
      fetchImpl,
      timeoutMs: 50,
    });
    await expect(client.getCurrentUser()).rejects.toMatchObject({
      code: PIPEDRIVE_ERROR_CODES.NETWORK_ERROR,
    });
  });

  it('throws when envelope.success is false', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: false,
        data: null,
        error: 'Something else',
        error_info: 'unexpected',
      })
    );
    const client = new PipedriveClient({
      accessToken: 'pipe_token',
      apiDomain: 'https://demo.pipedrive.com',
      fetchImpl,
    });
    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(ConnectorError);
  });

  it('does not retry on 5xx (caller decides)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { success: false, error: 'oops' }));
    const client = new PipedriveClient({
      accessToken: 'pipe_token',
      apiDomain: 'https://demo.pipedrive.com',
      fetchImpl,
    });
    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(ConnectorError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
