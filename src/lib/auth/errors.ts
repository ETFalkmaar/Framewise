export const AUTH_ERROR_CODES = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

abstract class AuthError extends Error {
  abstract readonly code: AuthErrorCode;
  abstract readonly status: number;
}

export class NotAuthenticatedError extends AuthError {
  readonly code = AUTH_ERROR_CODES.NOT_AUTHENTICATED;
  readonly status = 401;
  constructor(message = 'Not authenticated') {
    super(message);
    this.name = 'NotAuthenticatedError';
  }
}

export class ForbiddenError extends AuthError {
  readonly code = AUTH_ERROR_CODES.FORBIDDEN;
  readonly status = 403;
  readonly required: string;
  constructor(required: string, message?: string) {
    super(message ?? `Forbidden: ${required} required`);
    this.name = 'ForbiddenError';
    this.required = required;
  }
}

export class InvalidCredentialsError extends AuthError {
  readonly code = AUTH_ERROR_CODES.INVALID_CREDENTIALS;
  readonly status = 401;
  constructor(message = 'Invalid credentials') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class RateLimitedError extends AuthError {
  readonly code = AUTH_ERROR_CODES.RATE_LIMITED;
  readonly status = 429;
  constructor(retryAfterSeconds: number) {
    super(`Too many attempts. Try again in ${retryAfterSeconds} seconds`);
    this.name = 'RateLimitedError';
  }
}
