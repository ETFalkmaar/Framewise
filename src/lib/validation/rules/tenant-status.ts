import type { TenantStatus } from '@/types/database';
import { ValidationError, VALIDATION_ERROR_CODES } from '../errors';

/**
 * Allowed tenant status transitions.
 *
 * onboarding → live (only when required checklist items are completed —
 *                    that check belongs in the calling code, not here)
 * live       → paused | cancelled
 * paused     → live | cancelled
 * cancelled  → (terminal)
 */
const TRANSITIONS: Record<TenantStatus, ReadonlySet<TenantStatus>> = {
  onboarding: new Set(['live', 'cancelled']),
  live: new Set(['paused', 'cancelled']),
  paused: new Set(['live', 'cancelled']),
  cancelled: new Set(),
};

export function canTransitionTo(current: TenantStatus, next: TenantStatus): boolean {
  if (current === next) return true;
  return TRANSITIONS[current].has(next);
}

export function assertTransition(current: TenantStatus, next: TenantStatus): void {
  if (!canTransitionTo(current, next)) {
    throw new ValidationError(
      VALIDATION_ERROR_CODES.STATUS_TRANSITION_INVALID,
      `Cannot transition tenant from "${current}" to "${next}"`,
      { field: 'status' }
    );
  }
}
