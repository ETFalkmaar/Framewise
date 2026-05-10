import { describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { MailchimpClient } from '@/lib/connectors/providers/mailchimp/client';
import { MAILCHIMP_ERROR_CODES } from '@/lib/connectors/providers/mailchimp/errors';
import type { MailchimpAccount } from '@/lib/connectors/providers/mailchimp/types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_ACCOUNT: MailchimpAccount = {
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

describe('MailchimpClient constructor', () => {
  it('throws when accessToken is empty', () => {
    expect(
      () =>
        new MailchimpClient({
          accessToken: '',
          apiEndpoint: 'https://us1.api.mailchimp.com',
        })
    ).toThrow(/accessToken is required/);
  });

  it('throws when apiEndpoint is empty', () => {
    expect(
      () =>
        new MailchimpClient({
          accessToken: 'mc_token',
          apiEndpoint: '',
        })
    ).toThrow(/apiEndpoint is required/);
  });

  it('accepts valid options', () => {
    expect(
      () =>
        new MailchimpClient({
          accessToken: 'mc_token',
          apiEndpoint: 'https://us1.api.mailchimp.com',
        })
    ).not.toThrow();
  });

  it('exposes the resolved API endpoint', () => {
    const client = new MailchimpClient({
      accessToken: 'mc_token',
      apiEndpoint: 'https://us1.api.mailchimp.com',
    });
    expect(client.getApiEndpoint()).toBe('https://us1.api.mailchimp.com');
  });

  it('strips trailing slash from apiEndpoint', () => {
    const client = new MailchimpClient({
      accessToken: 'mc_token',
      apiEndpoint: 'https://us1.api.mailchimp.com/',
    });
    expect(client.getApiEndpoint()).toBe('https://us1.api.mailchimp.com');
  });
});

describe('MailchimpClient.getAccount', () => {
  it('returns parsed MailchimpAccount on 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new MailchimpClient({
      accessToken: 'mc_token',
      apiEndpoint: 'https://us1.api.mailchimp.com',
      fetchImpl,
    });
    const account = await client.getAccount();
    expect(account.account_id).toBe('abc123');
    expect(account.pricing_plan_type).toBe('forever_free');
    expect(account.total_subscribers).toBe(250);
  });

  it('hits the region-specific /3.0/ root', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new MailchimpClient({
      accessToken: 'mc_token',
      apiEndpoint: 'https://us1.api.mailchimp.com',
      fetchImpl,
    });
    await client.getAccount();
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://us1.api.mailchimp.com/3.0/');
  });

  it('uses a different host when apiEndpoint differs (region-aware)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new MailchimpClient({
      accessToken: 'mc_token',
      apiEndpoint: 'https://eu1.api.mailchimp.com',
      fetchImpl,
    });
    await client.getAccount();
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://eu1.api.mailchimp.com/3.0/');
  });

  it('uses "OAuth" prefix in Authorization header (NOT Bearer)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new MailchimpClient({
      accessToken: 'mc_token',
      apiEndpoint: 'https://us1.api.mailchimp.com',
      fetchImpl,
    });
    await client.getAccount();
    const headers = fetchImpl.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('OAuth mc_token');
    // Mailchimp's most common pitfall — assert the prefix isn't Bearer.
    expect(headers.Authorization).not.toMatch(/^Bearer /);
  });

  it('sends User-Agent + Accept headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ACCOUNT));
    const client = new MailchimpClient({
      accessToken: 'mc_token',
      apiEndpoint: 'https://us1.api.mailchimp.com',
      fetchImpl,
    });
    await client.getAccount();
    const headers = fetchImpl.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/Framewise/);
    expect(headers.Accept).toBe('application/json');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        title: 'API Key Invalid',
        detail: 'Your API key may be invalid',
      })
    );
    const client = new MailchimpClient({
      accessToken: 'mc_bad',
      apiEndpoint: 'https://us1.api.mailchimp.com',
      fetchImpl,
    });
    await expect(client.getAccount()).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws RATE_LIMITED ConnectorError on 429', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { title: 'Too Many Requests' }));
    const client = new MailchimpClient({
      accessToken: 'mc_token',
      apiEndpoint: 'https://us1.api.mailchimp.com',
      fetchImpl,
    });
    await expect(client.getAccount()).rejects.toMatchObject({
      code: MAILCHIMP_ERROR_CODES.RATE_LIMITED,
    });
  });

  it('wraps AbortError as NETWORK_ERROR via mailchimpNetworkError', async () => {
    const fetchImpl = vi.fn().mockImplementationOnce(async () => {
      const e = new Error('aborted');
      (e as { name?: string }).name = 'AbortError';
      throw e;
    });
    const client = new MailchimpClient({
      accessToken: 'mc_token',
      apiEndpoint: 'https://us1.api.mailchimp.com',
      fetchImpl,
      timeoutMs: 50,
    });
    await expect(client.getAccount()).rejects.toMatchObject({
      code: MAILCHIMP_ERROR_CODES.NETWORK_ERROR,
    });
  });

  it('does not retry on 5xx (caller decides)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { title: 'Internal Server Error' }));
    const client = new MailchimpClient({
      accessToken: 'mc_token',
      apiEndpoint: 'https://us1.api.mailchimp.com',
      fetchImpl,
    });
    await expect(client.getAccount()).rejects.toBeInstanceOf(ConnectorError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
