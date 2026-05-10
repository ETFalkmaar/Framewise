import { describe, expect, it } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import {
  HUBSPOT_ERROR_CODES,
  configurationIncomplete,
  hubspotNetworkError,
  mapHubSpotError,
} from '@/lib/connectors/providers/hubspot/errors';

function res(status: number, statusText: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, statusText, headers });
}

describe('mapHubSpotError', () => {
  it('400 → VALIDATION_FAILED with body.message', () => {
    const err = mapHubSpotError(res(400, 'Bad Request'), {
      status: 'error',
      message: 'Invalid input data',
      correlationId: '00000000-0000-0000-0000-000000000000',
      category: 'VALIDATION_ERROR',
    });
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(HUBSPOT_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('VALIDATION_ERROR');
    expect(err.message).toContain('Invalid input data');
  });

  it('401 → InvalidCredentialsError', () => {
    const err = mapHubSpotError(res(401, 'Unauthorized'), {
      status: 'error',
      message: 'Authentication credentials not found.',
    });
    expect(err).toBeInstanceOf(InvalidCredentialsError);
    expect(err.message).toMatch(/invalid|expired/i);
    expect(err.message).toContain('Authentication credentials');
  });

  it('403 → INSUFFICIENT_PERMISSIONS with category', () => {
    const err = mapHubSpotError(res(403, 'Forbidden'), {
      status: 'error',
      message: "This app hasn't been granted all required scopes",
      category: 'MISSING_SCOPES',
    });
    expect(err.code).toBe(HUBSPOT_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    expect(err.message).toContain('MISSING_SCOPES');
  });

  it('404 → RESOURCE_NOT_FOUND', () => {
    const err = mapHubSpotError(res(404, 'Not Found'));
    expect(err.code).toBe(HUBSPOT_ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('429 → RATE_LIMITED with retry-after detail', () => {
    const err = mapHubSpotError(res(429, 'Too Many Requests', { 'retry-after': '10' }), {
      status: 'error',
      message: 'You have reached your daily API call limit.',
      category: 'RATE_LIMIT',
    });
    expect(err.code).toBe(HUBSPOT_ERROR_CODES.RATE_LIMITED);
    expect(err.details?.retryAfter).toBe('10');
  });

  it('500 → PROVIDER_ERROR', () => {
    const err = mapHubSpotError(res(500, 'Internal Server Error'));
    expect(err.code).toBe(HUBSPOT_ERROR_CODES.PROVIDER_ERROR);
  });

  it('default unknown status → UNKNOWN_ERROR', () => {
    const err = mapHubSpotError(res(418, "I'm a teapot"));
    expect(err.code).toBe(HUBSPOT_ERROR_CODES.UNKNOWN_ERROR);
  });

  it('extracts message from OAuth-style envelope (error_description)', () => {
    const err = mapHubSpotError(res(400, 'Bad Request'), {
      error: 'BAD_AUTH_CODE',
      error_description: 'authorization code expired',
    });
    expect(err.code).toBe(HUBSPOT_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('authorization code expired');
  });

  it('falls back to plain string body', () => {
    const err = mapHubSpotError(res(500, 'Internal Server Error'), 'gateway timeout');
    expect(err.message).toContain('gateway timeout');
  });

  it('falls back to status text when body absent', () => {
    const err = mapHubSpotError(res(500, 'Internal Server Error'));
    expect(err.message).toContain('500');
  });
});

describe('hubspotNetworkError', () => {
  it('returns a ConnectorError with NETWORK_ERROR code', () => {
    const err = hubspotNetworkError('socket hang up');
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(HUBSPOT_ERROR_CODES.NETWORK_ERROR);
    expect(err.message).toContain('socket hang up');
  });
});

describe('configurationIncomplete', () => {
  it('returns a ConnectorError with CONFIGURATION_INCOMPLETE code', () => {
    const err = configurationIncomplete();
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(HUBSPOT_ERROR_CODES.CONFIGURATION_INCOMPLETE);
    expect(err.message).toMatch(/HubSpot/i);
  });
});
