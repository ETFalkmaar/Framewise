import { describe, expect, it } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import {
  PIPEDRIVE_ERROR_CODES,
  configurationIncomplete,
  mapPipedriveError,
  pipedriveNetworkError,
} from '@/lib/connectors/providers/pipedrive/errors';

function res(status: number, statusText: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, statusText, headers });
}

describe('mapPipedriveError', () => {
  it('400 → VALIDATION_FAILED with body.error_info', () => {
    const err = mapPipedriveError(res(400, 'Bad Request'), {
      success: false,
      error: 'Bad request',
      error_info: 'The provided email format is invalid',
    });
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(PIPEDRIVE_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('Bad request');
    expect(err.message).toContain('The provided email format is invalid');
  });

  it('401 → InvalidCredentialsError', () => {
    const err = mapPipedriveError(res(401, 'Unauthorized'), {
      success: false,
      error: 'Unauthorized',
      error_info: 'Please refer to the API documentation',
    });
    expect(err).toBeInstanceOf(InvalidCredentialsError);
    expect(err.message).toMatch(/invalid|expired/i);
  });

  it('403 → INSUFFICIENT_PERMISSIONS', () => {
    const err = mapPipedriveError(res(403, 'Forbidden'), {
      success: false,
      error: 'Forbidden',
      error_info: 'Token lacks required scope',
    });
    expect(err.code).toBe(PIPEDRIVE_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  });

  it('404 → RESOURCE_NOT_FOUND', () => {
    const err = mapPipedriveError(res(404, 'Not Found'));
    expect(err.code).toBe(PIPEDRIVE_ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('422 → VALIDATION_FAILED', () => {
    const err = mapPipedriveError(res(422, 'Unprocessable Entity'), {
      success: false,
      error_info: 'Person email already exists',
    });
    expect(err.code).toBe(PIPEDRIVE_ERROR_CODES.VALIDATION_FAILED);
  });

  it('429 → RATE_LIMITED with retry-after detail', () => {
    const err = mapPipedriveError(res(429, 'Too Many Requests', { 'retry-after': '2' }));
    expect(err.code).toBe(PIPEDRIVE_ERROR_CODES.RATE_LIMITED);
    expect(err.details?.retryAfter).toBe('2');
    expect(err.message).toMatch(/100 req/);
  });

  it('500 → PROVIDER_ERROR', () => {
    const err = mapPipedriveError(res(500, 'Internal Server Error'));
    expect(err.code).toBe(PIPEDRIVE_ERROR_CODES.PROVIDER_ERROR);
  });

  it('default unknown status → UNKNOWN_ERROR', () => {
    const err = mapPipedriveError(res(418, "I'm a teapot"));
    expect(err.code).toBe(PIPEDRIVE_ERROR_CODES.UNKNOWN_ERROR);
  });

  it('prefers error_info over plain error string', () => {
    const err = mapPipedriveError(res(400, 'Bad Request'), {
      error: 'Generic',
      error_info: 'Field "title" is required',
    });
    expect(err.message).toContain('Generic');
    expect(err.message).toContain('Field "title" is required');
  });

  it('handles OAuth-style envelope (error + error_description)', () => {
    const err = mapPipedriveError(res(400, 'Bad Request'), {
      error: 'invalid_grant',
      error_description: 'authorization code expired',
    });
    expect(err.code).toBe(PIPEDRIVE_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('invalid_grant');
    expect(err.message).toContain('authorization code expired');
  });

  it('falls back to plain string body', () => {
    const err = mapPipedriveError(res(500, 'Internal Server Error'), 'gateway timeout');
    expect(err.message).toContain('gateway timeout');
  });
});

describe('pipedriveNetworkError', () => {
  it('returns a ConnectorError with NETWORK_ERROR code', () => {
    const err = pipedriveNetworkError('socket hang up');
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(PIPEDRIVE_ERROR_CODES.NETWORK_ERROR);
    expect(err.message).toContain('socket hang up');
  });
});

describe('configurationIncomplete', () => {
  it('returns a ConnectorError with CONFIGURATION_INCOMPLETE code', () => {
    const err = configurationIncomplete();
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(PIPEDRIVE_ERROR_CODES.CONFIGURATION_INCOMPLETE);
    expect(err.message).toMatch(/Pipedrive/i);
  });
});
