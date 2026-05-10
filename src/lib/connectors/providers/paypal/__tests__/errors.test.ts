import { describe, expect, it } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import {
  PAYPAL_ERROR_CODES,
  configurationIncomplete,
  mapPayPalError,
  paypalNetworkError,
} from '@/lib/connectors/providers/paypal/errors';

function res(status: number, statusText: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, statusText, headers });
}

describe('mapPayPalError', () => {
  it('400 → VALIDATION_FAILED with OAuth error_description', () => {
    const err = mapPayPalError(res(400, 'Bad Request'), {
      error: 'invalid_grant',
      error_description: 'Authorization code expired',
    });
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(PAYPAL_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('invalid_grant');
    expect(err.message).toContain('Authorization code expired');
  });

  it('400 → VALIDATION_FAILED with REST API name+message', () => {
    const err = mapPayPalError(res(400, 'Bad Request'), {
      name: 'INVALID_REQUEST',
      message: 'Request is not well-formed',
      details: [],
    });
    expect(err.code).toBe(PAYPAL_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('INVALID_REQUEST');
    expect(err.message).toContain('Request is not well-formed');
  });

  it('401 → InvalidCredentialsError', () => {
    const err = mapPayPalError(res(401, 'Unauthorized'), {
      error: 'invalid_token',
      error_description: 'Access Token has expired',
    });
    expect(err).toBeInstanceOf(InvalidCredentialsError);
    expect(err.message).toMatch(/invalid|expired/i);
  });

  it('403 → INSUFFICIENT_PERMISSIONS', () => {
    const err = mapPayPalError(res(403, 'Forbidden'), {
      name: 'NOT_AUTHORIZED',
      message: 'Authorization failed due to insufficient permissions',
    });
    expect(err.code).toBe(PAYPAL_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  });

  it('404 → RESOURCE_NOT_FOUND', () => {
    const err = mapPayPalError(res(404, 'Not Found'));
    expect(err.code).toBe(PAYPAL_ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('422 → VALIDATION_FAILED', () => {
    const err = mapPayPalError(res(422, 'Unprocessable Entity'), {
      name: 'UNPROCESSABLE_ENTITY',
      message: 'The merchant has not been onboarded',
    });
    expect(err.code).toBe(PAYPAL_ERROR_CODES.VALIDATION_FAILED);
  });

  it('429 → RATE_LIMITED with retry-after detail', () => {
    const err = mapPayPalError(res(429, 'Too Many Requests', { 'retry-after': '60' }));
    expect(err.code).toBe(PAYPAL_ERROR_CODES.RATE_LIMITED);
    expect(err.details?.retryAfter).toBe('60');
  });

  it('500 → PROVIDER_ERROR', () => {
    const err = mapPayPalError(res(500, 'Internal Server Error'));
    expect(err.code).toBe(PAYPAL_ERROR_CODES.PROVIDER_ERROR);
  });

  it('default unknown status → UNKNOWN_ERROR', () => {
    const err = mapPayPalError(res(418, "I'm a teapot"));
    expect(err.code).toBe(PAYPAL_ERROR_CODES.UNKNOWN_ERROR);
  });

  it('falls back to plain string body', () => {
    const err = mapPayPalError(res(500, 'Internal Server Error'), 'gateway timeout');
    expect(err.message).toContain('gateway timeout');
  });

  it('extracts message from REST envelope when only name present', () => {
    const err = mapPayPalError(res(400, 'Bad Request'), { name: 'VALIDATION_ERROR' });
    expect(err.message).toContain('VALIDATION_ERROR');
  });
});

describe('paypalNetworkError', () => {
  it('returns a ConnectorError with NETWORK_ERROR code', () => {
    const err = paypalNetworkError('socket hang up');
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(PAYPAL_ERROR_CODES.NETWORK_ERROR);
    expect(err.message).toContain('socket hang up');
  });
});

describe('configurationIncomplete', () => {
  it('returns a ConnectorError with CONFIGURATION_INCOMPLETE code', () => {
    const err = configurationIncomplete();
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(PAYPAL_ERROR_CODES.CONFIGURATION_INCOMPLETE);
    expect(err.message).toMatch(/PayPal/i);
  });
});
