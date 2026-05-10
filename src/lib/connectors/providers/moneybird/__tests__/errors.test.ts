import { describe, expect, it } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import {
  MONEYBIRD_ERROR_CODES,
  mapMoneybirdError,
  networkError,
} from '@/lib/connectors/providers/moneybird/errors';

function makeResponse(
  status: number,
  statusText: string,
  headers: Record<string, string> = {}
): Response {
  return new Response(null, { status, statusText, headers });
}

describe('mapMoneybirdError', () => {
  it('401 → InvalidCredentialsError', () => {
    const err = mapMoneybirdError(makeResponse(401, 'Unauthorized'));
    expect(err).toBeInstanceOf(InvalidCredentialsError);
    expect(err.message).toMatch(/invalid|expired/i);
  });

  it('403 → INSUFFICIENT_PERMISSIONS', () => {
    const err = mapMoneybirdError(makeResponse(403, 'Forbidden'));
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(MONEYBIRD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    expect(err.message).toContain('permission');
  });

  it('404 → RESOURCE_NOT_FOUND', () => {
    const err = mapMoneybirdError(makeResponse(404, 'Not Found'));
    expect(err.code).toBe(MONEYBIRD_ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('422 → VALIDATION_FAILED with body errors flattened', () => {
    const err = mapMoneybirdError(makeResponse(422, 'Unprocessable Entity'), {
      errors: { name: ["can't be blank"], reference: ['is invalid'] },
    });
    expect(err.code).toBe(MONEYBIRD_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('name');
    expect(err.message).toContain("can't be blank");
    expect(err.message).toContain('reference');
  });

  it('429 → RATE_LIMITED with retry-after detail', () => {
    const err = mapMoneybirdError(makeResponse(429, 'Too Many Requests', { 'retry-after': '60' }));
    expect(err.code).toBe(MONEYBIRD_ERROR_CODES.RATE_LIMITED);
    expect(err.details?.retryAfter).toBe('60');
    expect(err.details?.status).toBe(429);
  });

  it('5xx → PROVIDER_ERROR', () => {
    const err = mapMoneybirdError(makeResponse(503, 'Service Unavailable'));
    expect(err.code).toBe(MONEYBIRD_ERROR_CODES.PROVIDER_ERROR);
    expect(err.details?.status).toBe(503);
  });

  it('default unknown status → UNKNOWN_ERROR', () => {
    const err = mapMoneybirdError(makeResponse(418, "I'm a teapot"));
    expect(err.code).toBe(MONEYBIRD_ERROR_CODES.UNKNOWN_ERROR);
  });

  it('uses body.error string when present', () => {
    const err = mapMoneybirdError(makeResponse(401, 'Unauthorized'), {
      error: 'token revoked at 2026-05-01',
    });
    expect(err.message).toContain('token revoked');
  });

  it('falls back to plain string body', () => {
    const err = mapMoneybirdError(makeResponse(500, 'Internal Server Error'), 'boom');
    expect(err.message).toContain('boom');
  });
});

describe('networkError', () => {
  it('returns a ConnectorError with NETWORK_ERROR code', () => {
    const err = networkError('timed out');
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(MONEYBIRD_ERROR_CODES.NETWORK_ERROR);
    expect(err.message).toContain('timed out');
  });
});
