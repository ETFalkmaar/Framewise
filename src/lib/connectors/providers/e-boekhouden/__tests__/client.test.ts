import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import { EBoekhoudenClient } from '@/lib/connectors/providers/e-boekhouden/client';
import { EBOEKHOUDEN_ERROR_CODES } from '@/lib/connectors/providers/e-boekhouden/errors';
import { __resetSessionCache } from '@/lib/connectors/providers/e-boekhouden/session-cache';
import type {
  EBoekhoudenAdministration,
  EBoekhoudenSessionResponse,
} from '@/lib/connectors/providers/e-boekhouden/types';

beforeEach(() => __resetSessionCache());
afterEach(() => __resetSessionCache());

const SAMPLE_SESSION: EBoekhoudenSessionResponse = {
  token: 'sess_abc123',
  expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};
const SAMPLE_ADMIN: EBoekhoudenAdministration = {
  id: 'adm_1',
  name: 'Demo Restaurant Amsterdam B.V.',
  vatNumber: 'NL000099998B01',
  country: 'NL',
  currency: 'EUR',
};

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

function client(fetchImpl: typeof fetch, cacheKey = `key_${Math.random()}`) {
  return new EBoekhoudenClient({
    userApiToken: 'user_api_token_value_long_enough_to_pass_validation_check',
    sourceApiToken: 'source_api_token_from_env',
    fetchImpl,
    cacheKey,
    timeoutMs: 5_000,
  });
}

describe('EBoekhoudenClient.startSession', () => {
  it('returns the session token on 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_SESSION));
    const result = await client(fetchImpl).startSession();
    expect(result).toBe(SAMPLE_SESSION.token);
  });

  it('hits POST /session with both tokens in the body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_SESSION));
    await client(fetchImpl).startSession();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.e-boekhouden.nl/v1/session');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.accessToken).toMatch(/^user_api_token/);
    expect(body.source).toBe('source_api_token_from_env');
  });

  it('throws InvalidCredentialsError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'invalid' }));
    await expect(client(fetchImpl).startSession()).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws ConnectorError on malformed session payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { weird: 'shape' }));
    await expect(client(fetchImpl).startSession()).rejects.toBeInstanceOf(ConnectorError);
  });
});

describe('EBoekhoudenClient.getAdministration (caching + retry)', () => {
  it('cached session: 1 fetch (admin only)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, SAMPLE_ADMIN));
    // Pre-warm the cache.
    const c = client(fetchImpl, 'pre-warmed');
    // Manually seed via startSession-like mechanism: prime the cache by calling
    // startSession() via a separate fetch mock.
    const primer = vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_SESSION));
    const c2 = client(primer, 'pre-warmed');
    await c2.startSession();
    const result = await c.getAdministration();
    expect(result).toEqual(SAMPLE_ADMIN);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.e-boekhouden.nl/v1/administration');
    expect((init as RequestInit).method).toBeUndefined(); // GET default
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SAMPLE_SESSION.token}`);
  });

  it('cold cache: 2 fetches (session create + admin)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_SESSION))
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ADMIN));
    const result = await client(fetchImpl, 'cold').getAdministration();
    expect(result).toEqual(SAMPLE_ADMIN);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]![0]).toContain('/session');
    expect(fetchImpl.mock.calls[1]![0]).toContain('/administration');
  });

  it('401 on authenticated request: invalidates cache, retries with fresh session', async () => {
    const FRESH = { ...SAMPLE_SESSION, token: 'sess_fresh_xyz' };
    const fetchImpl = vi
      .fn()
      // First: initial session create
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_SESSION))
      // Second: admin call returns 401 (stale session)
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      // Third: fresh session create
      .mockResolvedValueOnce(jsonResponse(200, FRESH))
      // Fourth: retry succeeds
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_ADMIN));
    const result = await client(fetchImpl, 'retry-key').getAdministration();
    expect(result).toEqual(SAMPLE_ADMIN);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    // Last admin call must use the fresh token.
    const lastInit = fetchImpl.mock.calls[3]![1] as RequestInit;
    expect((lastInit.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${FRESH.token}`
    );
  });

  it('429 surfaces RATE_LIMITED', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_SESSION))
      .mockResolvedValueOnce(jsonResponse(429, { message: 'too many' }, { 'retry-after': '120' }));
    let caught: unknown;
    try {
      await client(fetchImpl, 'rl-key').getAdministration();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConnectorError);
    expect((caught as ConnectorError).code).toBe(EBOEKHOUDEN_ERROR_CODES.RATE_LIMITED);
  });
});

describe('EBoekhoudenClient timeouts + headers', () => {
  it('passes an AbortSignal so timeouts are honoured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_SESSION));
    await client(fetchImpl).startSession();
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('AbortError → NETWORK_ERROR via networkError()', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    let caught: unknown;
    try {
      await client(fetchImpl).startSession();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConnectorError);
    expect((caught as ConnectorError).code).toBe(EBOEKHOUDEN_ERROR_CODES.NETWORK_ERROR);
    expect((caught as ConnectorError).message).toContain('timed out');
  });

  it('sets Accept, Content-Type and User-Agent headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, SAMPLE_SESSION));
    await client(fetchImpl).startSession();
    const headers = (fetchImpl.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['User-Agent']).toContain('Framewise');
  });

  it('throws when constructor receives empty userApiToken', () => {
    expect(
      () =>
        new EBoekhoudenClient({
          userApiToken: '',
          sourceApiToken: 'x',
          fetchImpl: vi.fn(),
        })
    ).toThrow();
  });

  it('throws when constructor receives empty sourceApiToken', () => {
    expect(
      () =>
        new EBoekhoudenClient({
          userApiToken: 'x',
          sourceApiToken: '',
          fetchImpl: vi.fn(),
        })
    ).toThrow();
  });
});

describe('EBoekhoudenClient.endSession', () => {
  it('is a no-op when no cached session exists', async () => {
    const fetchImpl = vi.fn();
    await client(fetchImpl, 'no-cache-key').endSession();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('calls DELETE /session and invalidates cache when one exists', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_SESSION))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const c = client(fetchImpl, 'end-key');
    await c.startSession();
    await c.endSession();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[1]!;
    expect(url).toContain('/session');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('swallows DELETE errors (best-effort cleanup)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_SESSION))
      .mockRejectedValueOnce(new Error('network down'));
    const c = client(fetchImpl, 'swallow-key');
    await c.startSession();
    await expect(c.endSession()).resolves.toBeUndefined();
  });
});
