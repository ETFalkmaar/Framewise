import type { TenantResolutionInput, TenantResolutionResult } from '../types';

/**
 * Terminal strategy — always returns "no tenant".
 * Used when none of the other strategies match.
 */
export async function resolveDefault(
  _input: TenantResolutionInput
): Promise<TenantResolutionResult> {
  return { tenantId: null, strategy: 'none' };
}
