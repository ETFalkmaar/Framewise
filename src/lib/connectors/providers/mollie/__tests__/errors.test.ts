import { describe, expect, it } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import {
  MOLLIE_ERROR_CODES,
  mapMollieError,
  mollieNetworkError,
} from '@/lib/connectors/providers/mollie/errors';

function res(status: number, statusText: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, statusText, headers });
}

describe('mapMollieError', () => {
  it('401 → InvalidCredentialsError', () => {
    const err = mapMollieError(res(401, 'Unauthorized'), { detail: 'invalid api key' });
    expect(err).toBeInstanceOf(InvalidCredentialsError);
    expect(err.message).toMatch(/invalid|revoked/i);
    expect(err.message).toContain('invalid api key');
  });

  it('403 → INSUFFICIENT_PERMISSIONS', () => {
    const err = mapMollieError(res(403, 'Forbidden'), { detail: 'scope missing' });
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(MOLLIE_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    expect(err.message).toContain('scope');
  });

  it('404 → RESOURCE_NOT_FOUND', () => {
    const err = mapMollieError(res(404, 'Not Found'));
    expect(err.code).toBe(MOLLIE_ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('422 → VALIDATION_FAILED with body.detail', () => {
    const err = mapMollieError(res(422, 'Unprocessable Entity'), {
      status: 422,
      title: 'Unprocessable Entity',
      detail: 'amount.value must be a string',
    });
    expect(err.code).toBe(MOLLIE_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('amount.value must be a string');
  });

  it('429 → RATE_LIMITED with retry-after detail', () => {
    const err = mapMollieError(res(429, 'Too Many Requests', { 'retry-after': '60' }));
    expect(err.code).toBe(MOLLIE_ERROR_CODES.RATE_LIMITED);
    expect(err.details?.retryAfter).toBe('60');
    expect(err.message).toMatch(/600\/5min/);
  });

  it('5xx → PROVIDER_ERROR', () => {
    const err = mapMollieError(res(503, 'Service Unavailable'));
    expect(err.code).toBe(MOLLIE_ERROR_CODES.PROVIDER_ERROR);
  });

  it('default unknown status → UNKNOWN_ERROR', () => {
    const err = mapMollieError(res(418, "I'm a teapot"));
    expect(err.code).toBe(MOLLIE_ERROR_CODES.UNKNOWN_ERROR);
  });

  it('falls back to body.title when detail missing', () => {
    const err = mapMollieError(res(401, 'Unauthorized'), {
      status: 401,
      title: 'Unauthorized Request',
    });
    expect(err.message).toContain('Unauthorized Request');
  });

  it('falls back to plain string body', () => {
    const err = mapMollieError(res(500, 'Internal Server Error'), 'oops');
    expect(err.message).toContain('oops');
  });
});

describe('mollieNetworkError', () => {
  it('returns a ConnectorError with NETWORK_ERROR code', () => {
    const err = mollieNetworkError('socket hang up');
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(MOLLIE_ERROR_CODES.NETWORK_ERROR);
    expect(err.message).toContain('socket hang up');
  });
});
