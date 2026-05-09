export {
  TENANT_ERROR_CODES,
  TenantNotFoundError,
  TenantPausedError,
  TenantCancelledError,
  TenantOnboardingError,
  type TenantErrorCode,
} from './errors';

export {
  resolveTenant,
  type TenantResolutionInput,
  type TenantResolutionResult,
  type TenantResolutionStrategy,
} from './resolver';

export {
  getCurrentTenant,
  requireCurrentTenant,
  getCurrentTenantWithSubscription,
  TENANT_HEADER,
  TENANT_STRATEGY_HEADER,
} from './context';

export {
  TenantProvider,
  useTenant,
  useOptionalTenant,
  usePlan,
  useOptionalPlan,
} from './client-context';
