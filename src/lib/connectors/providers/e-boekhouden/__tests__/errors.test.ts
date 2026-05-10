import { describe, expect, it } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import {
  EBOEKHOUDEN_ERROR_CODES,
  configurationIncomplete,
  mapEBoekhoudenError,
  networkError,
} from '@/lib/connectors/providers/e-boekhouden/errors';

function res(status: number, statusText: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, statusText, headers });
}

describe('mapEBoekhoudenError', () => {
  it('400 → VALIDATION_FAILED with body message', () => {
    const err = mapEBoekhoudenError(res(400, 'Bad Request'), { message: 'amount is required' });
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(EBOEKHOUDEN_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('amount is required');
  });

  it('401 → InvalidCredentialsError', () => {
    const err = mapEBoekhoudenError(res(401, 'Unauthorized'));
    expect(err).toBeInstanceOf(InvalidCredentialsError);
    expect(err.message).toMatch(/invalid|expired/i);
  });

  it('403 → INSUFFICIENT_PERMISSIONS', () => {
    const err = mapEBoekhoudenError(res(403, 'Forbidden'));
    expect(err.code).toBe(EBOEKHOUDEN_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    expect(err.message).toContain('scope');
  });

  it('404 → RESOURCE_NOT_FOUND', () => {
    const err = mapEBoekhoudenError(res(404, 'Not Found'));
    expect(err.code).toBe(EBOEKHOUDEN_ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('429 → RATE_LIMITED with retry-after detail', () => {
    const err = mapEBoekhoudenError(res(429, 'Too Many Requests', { 'retry-after': '60' }));
    expect(err.code).toBe(EBOEKHOUDEN_ERROR_CODES.RATE_LIMITED);
    expect(err.details?.retryAfter).toBe('60');
    expect(err.message).toMatch(/1000\/min/);
  });

  it('5xx → PROVIDER_ERROR', () => {
    const err = mapEBoekhoudenError(res(503, 'Service Unavailable'));
    expect(err.code).toBe(EBOEKHOUDEN_ERROR_CODES.PROVIDER_ERROR);
  });

  it('default unknown status → UNKNOWN_ERROR', () => {
    const err = mapEBoekhoudenError(res(418, "I'm a teapot"));
    expect(err.code).toBe(EBOEKHOUDEN_ERROR_CODES.UNKNOWN_ERROR);
  });

  it('flattens body.errors arrays into the message', () => {
    const err = mapEBoekhoudenError(res(400, 'Bad Request'), {
      errors: [
        { field: 'name', message: 'is required' },
        { field: 'vat', message: 'invalid format' },
      ],
    });
    expect(err.message).toContain('name: is required');
    expect(err.message).toContain('vat: invalid format');
  });

  it('falls back to plain string body', () => {
    const err = mapEBoekhoudenError(res(500, 'Internal Server Error'), 'oops');
    expect(err.message).toContain('oops');
  });
});

describe('networkError + configurationIncomplete', () => {
  it('networkError returns a ConnectorError with NETWORK_ERROR code', () => {
    const err = networkError('socket hang up');
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(EBOEKHOUDEN_ERROR_CODES.NETWORK_ERROR);
    expect(err.message).toContain('socket hang up');
  });

  it('configurationIncomplete returns CONFIGURATION_INCOMPLETE with friendly text', () => {
    const err = configurationIncomplete();
    expect(err.code).toBe(EBOEKHOUDEN_ERROR_CODES.CONFIGURATION_INCOMPLETE);
    expect(err.message).toMatch(/Source API Token/);
    expect(err.message).toMatch(/support@e-boekhouden\.nl/);
  });
});
