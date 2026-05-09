import type { SubscriptionPlan, Tenant } from '@/types/database';
import { ValidationError, VALIDATION_ERROR_CODES } from '../errors';

/** Returns true when the tenant's plan exposes the given feature flag. */
export function tenantHasFeature(
  _tenant: Tenant,
  plan: SubscriptionPlan,
  featureKey: string
): boolean {
  return Boolean(plan.features?.[featureKey]);
}

/**
 * Throws a ValidationError when the feature is unavailable on the
 * tenant's current plan. Use this at the entry point of any feature-
 * gated repository action (e.g. creating a booking on a plan without
 * `booking: true`).
 */
export function assertFeature(tenant: Tenant, plan: SubscriptionPlan, featureKey: string): void {
  if (!tenantHasFeature(tenant, plan, featureKey)) {
    throw new ValidationError(
      VALIDATION_ERROR_CODES.FEATURE_NOT_AVAILABLE,
      `Feature "${featureKey}" is not available on plan "${plan.code}"`,
      { field: 'plan' }
    );
  }
}
