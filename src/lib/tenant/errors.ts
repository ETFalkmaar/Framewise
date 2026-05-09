export const TENANT_ERROR_CODES = {
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_PAUSED: 'TENANT_PAUSED',
  TENANT_CANCELLED: 'TENANT_CANCELLED',
  TENANT_ONBOARDING: 'TENANT_ONBOARDING',
} as const;

export type TenantErrorCode = (typeof TENANT_ERROR_CODES)[keyof typeof TENANT_ERROR_CODES];

abstract class TenantError extends Error {
  abstract readonly code: TenantErrorCode;
}

export class TenantNotFoundError extends TenantError {
  readonly code = TENANT_ERROR_CODES.TENANT_NOT_FOUND;
  constructor(detail?: string) {
    super(`Tenant not found${detail ? `: ${detail}` : ''}`);
    this.name = 'TenantNotFoundError';
  }
}

export class TenantPausedError extends TenantError {
  readonly code = TENANT_ERROR_CODES.TENANT_PAUSED;
  constructor(slug: string) {
    super(`Tenant "${slug}" is paused`);
    this.name = 'TenantPausedError';
  }
}

export class TenantCancelledError extends TenantError {
  readonly code = TENANT_ERROR_CODES.TENANT_CANCELLED;
  constructor(slug: string) {
    super(`Tenant "${slug}" is cancelled`);
    this.name = 'TenantCancelledError';
  }
}

export class TenantOnboardingError extends TenantError {
  readonly code = TENANT_ERROR_CODES.TENANT_ONBOARDING;
  constructor(slug: string) {
    super(`Tenant "${slug}" is still onboarding`);
    this.name = 'TenantOnboardingError';
  }
}
