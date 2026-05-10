import { describe, expect, it } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import {
  BREVO_ERROR_CODES,
  brevoNetworkError,
  mapBrevoError,
} from '@/lib/connectors/providers/brevo/errors';

function res(status: number, statusText: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, statusText, headers });
}

describe('mapBrevoError', () => {
  it('400 → VALIDATION_FAILED with code + message', () => {
    const err = mapBrevoError(res(400, 'Bad Request'), {
      code: 'invalid_parameter',
      message: 'Email is not in valid format',
    });
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(BREVO_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('invalid_parameter');
    expect(err.message).toContain('Email is not in valid format');
  });

  it('401 → InvalidCredentialsError', () => {
    const err = mapBrevoError(res(401, 'Unauthorized'), {
      code: 'unauthorized',
      message: 'Key not found',
    });
    expect(err).toBeInstanceOf(InvalidCredentialsError);
    expect(err.message).toMatch(/invalid|revoked/i);
    expect(err.message).toContain('Key not found');
  });

  it('402 → PAYMENT_REQUIRED for credits exhausted', () => {
    const err = mapBrevoError(res(402, 'Payment Required'), {
      code: 'unavailable',
      message: 'Not enough email credits',
    });
    expect(err.code).toBe(BREVO_ERROR_CODES.PAYMENT_REQUIRED);
    expect(err.message).toContain('Not enough email credits');
  });

  it('403 → INSUFFICIENT_PERMISSIONS', () => {
    const err = mapBrevoError(res(403, 'Forbidden'), {
      code: 'permission_denied',
      message: 'Your key cannot access this resource',
    });
    expect(err.code).toBe(BREVO_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  });

  it('404 → RESOURCE_NOT_FOUND', () => {
    const err = mapBrevoError(res(404, 'Not Found'));
    expect(err.code).toBe(BREVO_ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('405 → METHOD_NOT_ALLOWED', () => {
    const err = mapBrevoError(res(405, 'Method Not Allowed'));
    expect(err.code).toBe(BREVO_ERROR_CODES.METHOD_NOT_ALLOWED);
  });

  it('406 → NOT_ACCEPTABLE', () => {
    const err = mapBrevoError(res(406, 'Not Acceptable'));
    expect(err.code).toBe(BREVO_ERROR_CODES.NOT_ACCEPTABLE);
  });

  it('429 → RATE_LIMITED with retry-after detail', () => {
    const err = mapBrevoError(res(429, 'Too Many Requests', { 'retry-after': '5' }));
    expect(err.code).toBe(BREVO_ERROR_CODES.RATE_LIMITED);
    expect(err.details?.retryAfter).toBe('5');
    expect(err.message).toMatch(/600 req|10s/);
  });

  it('500 → PROVIDER_ERROR', () => {
    const err = mapBrevoError(res(500, 'Internal Server Error'));
    expect(err.code).toBe(BREVO_ERROR_CODES.PROVIDER_ERROR);
  });

  it('default unknown status → UNKNOWN_ERROR', () => {
    const err = mapBrevoError(res(418, "I'm a teapot"));
    expect(err.code).toBe(BREVO_ERROR_CODES.UNKNOWN_ERROR);
  });

  it('falls back to message-only when code absent', () => {
    const err = mapBrevoError(res(401, 'Unauthorized'), { message: 'API key required' });
    expect(err.message).toContain('API key required');
  });

  it('falls back to plain string body', () => {
    const err = mapBrevoError(res(500, 'Internal Server Error'), 'gateway timeout');
    expect(err.message).toContain('gateway timeout');
  });
});

describe('brevoNetworkError', () => {
  it('returns a ConnectorError with NETWORK_ERROR code', () => {
    const err = brevoNetworkError('socket hang up');
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(BREVO_ERROR_CODES.NETWORK_ERROR);
    expect(err.message).toContain('socket hang up');
  });
});
