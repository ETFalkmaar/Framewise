import { z } from 'zod';

export const VALIDATION_ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  BOOKING_CONFLICT: 'BOOKING_CONFLICT',
  STATUS_TRANSITION_INVALID: 'STATUS_TRANSITION_INVALID',
  SLUG_NOT_UNIQUE: 'SLUG_NOT_UNIQUE',
  EMAIL_NOT_UNIQUE: 'EMAIL_NOT_UNIQUE',
  NOT_FOUND: 'NOT_FOUND',
  PROVIDER_NOT_AVAILABLE_IN_COUNTRY: 'PROVIDER_NOT_AVAILABLE_IN_COUNTRY',
} as const;

export type ValidationErrorCode =
  (typeof VALIDATION_ERROR_CODES)[keyof typeof VALIDATION_ERROR_CODES];

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ValidationError extends Error {
  readonly code: ValidationErrorCode;
  readonly field?: string;
  readonly issues: ValidationIssue[];

  constructor(
    code: ValidationErrorCode,
    message: string,
    options: { field?: string; issues?: ValidationIssue[] } = {}
  ) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = options.field;
    this.issues = options.issues ?? [];
  }
}

/** Convert a zod error into a ValidationError. */
export function zodIssuesToValidationError(
  error: z.ZodError,
  message = 'Invalid input'
): ValidationError {
  const issues: ValidationIssue[] = error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  const field = issues[0]?.path;
  return new ValidationError(VALIDATION_ERROR_CODES.INVALID_INPUT, message, {
    field,
    issues,
  });
}

/** Parse with a zod schema and throw a ValidationError on failure. */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown, message?: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw zodIssuesToValidationError(result.error, message);
  }
  return result.data;
}
