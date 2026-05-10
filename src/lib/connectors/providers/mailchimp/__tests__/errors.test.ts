import { describe, expect, it } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import {
  MAILCHIMP_ERROR_CODES,
  configurationIncomplete,
  mailchimpNetworkError,
  mapMailchimpError,
} from '@/lib/connectors/providers/mailchimp/errors';

function res(status: number, statusText: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, statusText, headers });
}

describe('mapMailchimpError', () => {
  it('400 → VALIDATION_FAILED with title + detail (RFC 7807)', () => {
    const err = mapMailchimpError(res(400, 'Bad Request'), {
      type: 'https://mailchimp.com/developer/marketing/docs/errors/',
      title: 'Invalid Resource',
      status: 400,
      detail: 'The resource submitted could not be validated',
      instance: '00000000-0000-0000-0000-000000000000',
    });
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(MAILCHIMP_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('Invalid Resource');
    expect(err.message).toContain('The resource submitted could not be validated');
  });

  it('401 → InvalidCredentialsError', () => {
    const err = mapMailchimpError(res(401, 'Unauthorized'), {
      title: 'API Key Invalid',
      status: 401,
      detail: 'Your API key may be invalid, or you have attempted to access the wrong dc',
    });
    expect(err).toBeInstanceOf(InvalidCredentialsError);
    expect(err.message).toMatch(/invalid|expired/i);
  });

  it('403 → INSUFFICIENT_PERMISSIONS', () => {
    const err = mapMailchimpError(res(403, 'Forbidden'), {
      title: 'Forbidden',
      detail: 'You are not allowed to access the requested resource',
    });
    expect(err.code).toBe(MAILCHIMP_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  });

  it('404 → RESOURCE_NOT_FOUND', () => {
    const err = mapMailchimpError(res(404, 'Not Found'));
    expect(err.code).toBe(MAILCHIMP_ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('422 → VALIDATION_FAILED', () => {
    const err = mapMailchimpError(res(422, 'Unprocessable Entity'), {
      title: 'Member Exists',
      detail: 'someone@example.com is already a list member',
    });
    expect(err.code).toBe(MAILCHIMP_ERROR_CODES.VALIDATION_FAILED);
  });

  it('429 → RATE_LIMITED', () => {
    const err = mapMailchimpError(res(429, 'Too Many Requests', { 'retry-after': '5' }));
    expect(err.code).toBe(MAILCHIMP_ERROR_CODES.RATE_LIMITED);
    expect(err.details?.retryAfter).toBe('5');
    expect(err.message).toMatch(/10 simultaneous/);
  });

  it('500 → PROVIDER_ERROR', () => {
    const err = mapMailchimpError(res(500, 'Internal Server Error'));
    expect(err.code).toBe(MAILCHIMP_ERROR_CODES.PROVIDER_ERROR);
  });

  it('default unknown status → UNKNOWN_ERROR', () => {
    const err = mapMailchimpError(res(418, "I'm a teapot"));
    expect(err.code).toBe(MAILCHIMP_ERROR_CODES.UNKNOWN_ERROR);
  });

  it('handles OAuth-style envelope (error + error_description)', () => {
    const err = mapMailchimpError(res(400, 'Bad Request'), {
      error: 'invalid_grant',
      error_description: 'authorization code expired',
    });
    expect(err.code).toBe(MAILCHIMP_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('invalid_grant');
    expect(err.message).toContain('authorization code expired');
  });

  it('falls back to detail-only when title absent', () => {
    const err = mapMailchimpError(res(400, 'Bad Request'), {
      detail: 'something went wrong',
    });
    expect(err.message).toContain('something went wrong');
  });

  it('falls back to plain string body', () => {
    const err = mapMailchimpError(res(500, 'Internal Server Error'), 'gateway timeout');
    expect(err.message).toContain('gateway timeout');
  });
});

describe('mailchimpNetworkError', () => {
  it('returns a ConnectorError with NETWORK_ERROR code', () => {
    const err = mailchimpNetworkError('socket hang up');
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(MAILCHIMP_ERROR_CODES.NETWORK_ERROR);
    expect(err.message).toContain('socket hang up');
  });
});

describe('configurationIncomplete', () => {
  it('returns a ConnectorError with CONFIGURATION_INCOMPLETE code', () => {
    const err = configurationIncomplete();
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(MAILCHIMP_ERROR_CODES.CONFIGURATION_INCOMPLETE);
    expect(err.message).toMatch(/Mailchimp/i);
  });
});
