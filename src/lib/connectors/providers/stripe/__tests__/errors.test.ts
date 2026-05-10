import { describe, expect, it } from 'vitest';
import { ConnectorError, InvalidCredentialsError } from '@/lib/connectors';
import {
  STRIPE_ERROR_CODES,
  configurationIncomplete,
  mapStripeError,
  stripeNetworkError,
} from '@/lib/connectors/providers/stripe/errors';

function res(status: number, statusText: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, statusText, headers });
}

describe('mapStripeError', () => {
  it('400 → VALIDATION_FAILED with body.error.message', () => {
    const err = mapStripeError(res(400, 'Bad Request'), {
      error: { type: 'invalid_request_error', message: 'amount must be positive' },
    });
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(STRIPE_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('amount must be positive');
  });

  it('401 → InvalidCredentialsError', () => {
    const err = mapStripeError(res(401, 'Unauthorized'), {
      error: { type: 'invalid_request_error', message: 'Invalid API Key provided' },
    });
    expect(err).toBeInstanceOf(InvalidCredentialsError);
    expect(err.message).toMatch(/invalid|revoked/i);
    expect(err.message).toContain('Invalid API Key');
  });

  it('402 → PAYMENT_REQUIRED', () => {
    const err = mapStripeError(res(402, 'Payment Required'), {
      error: { type: 'card_error', message: 'card_declined' },
    });
    expect(err.code).toBe(STRIPE_ERROR_CODES.PAYMENT_REQUIRED);
    expect(err.message).toContain('card_declined');
  });

  it('403 → INSUFFICIENT_PERMISSIONS', () => {
    const err = mapStripeError(res(403, 'Forbidden'), {
      error: { message: 'Token lacks the required scopes' },
    });
    expect(err.code).toBe(STRIPE_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  });

  it('404 → RESOURCE_NOT_FOUND', () => {
    const err = mapStripeError(res(404, 'Not Found'));
    expect(err.code).toBe(STRIPE_ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('429 → RATE_LIMITED with retry-after detail', () => {
    const err = mapStripeError(res(429, 'Too Many Requests', { 'retry-after': '30' }));
    expect(err.code).toBe(STRIPE_ERROR_CODES.RATE_LIMITED);
    expect(err.details?.retryAfter).toBe('30');
  });

  it('500 → PROVIDER_ERROR', () => {
    const err = mapStripeError(res(500, 'Internal Server Error'));
    expect(err.code).toBe(STRIPE_ERROR_CODES.PROVIDER_ERROR);
  });

  it('default unknown status → UNKNOWN_ERROR', () => {
    const err = mapStripeError(res(418, "I'm a teapot"));
    expect(err.code).toBe(STRIPE_ERROR_CODES.UNKNOWN_ERROR);
  });

  it('extracts message from OAuth-token envelope (error + error_description)', () => {
    const err = mapStripeError(res(400, 'Bad Request'), {
      error: 'invalid_grant',
      error_description: 'Authorization code already redeemed',
    });
    expect(err.code).toBe(STRIPE_ERROR_CODES.VALIDATION_FAILED);
    expect(err.message).toContain('invalid_grant');
    expect(err.message).toContain('Authorization code already redeemed');
  });

  it('falls back to plain string body', () => {
    const err = mapStripeError(res(500, 'Internal Server Error'), 'bad gateway');
    expect(err.message).toContain('bad gateway');
  });

  it('falls back to status text when body absent', () => {
    const err = mapStripeError(res(500, 'Internal Server Error'));
    expect(err.message).toContain('500');
  });
});

describe('stripeNetworkError', () => {
  it('returns a ConnectorError with NETWORK_ERROR code', () => {
    const err = stripeNetworkError('socket hang up');
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(STRIPE_ERROR_CODES.NETWORK_ERROR);
    expect(err.message).toContain('socket hang up');
  });
});

describe('configurationIncomplete', () => {
  it('returns a ConnectorError with CONFIGURATION_INCOMPLETE code', () => {
    const err = configurationIncomplete();
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe(STRIPE_ERROR_CODES.CONFIGURATION_INCOMPLETE);
    expect(err.message).toMatch(/Connect/i);
  });
});
