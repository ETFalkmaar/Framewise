import { resolveByCustomDomain } from './strategies/custom-domain';
import { resolveBySubdomain } from './strategies/subdomain';
import { resolveByPathPrefix } from './strategies/path-prefix';
import { resolveDefault } from './strategies/default';
import type { TenantResolutionInput, TenantResolutionResult } from './types';

const STRATEGIES = [resolveByCustomDomain, resolveBySubdomain, resolveByPathPrefix];

/**
 * Tries each resolution strategy in priority order; the first non-null
 * result wins. Falls back to `{ tenantId: null, strategy: 'none' }`.
 */
export async function resolveTenant(input: TenantResolutionInput): Promise<TenantResolutionResult> {
  for (const strategy of STRATEGIES) {
    const result = await strategy(input);
    if (result) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(
          `[tenant] ${input.hostname}${input.pathname} → strategy=${result.strategy} tenantId=${result.tenantId}${result.matchedSlug ? ` slug=${result.matchedSlug}` : ''}`
        );
      }
      return result;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[tenant] ${input.hostname}${input.pathname} → strategy=none`);
  }
  return resolveDefault(input);
}

export type {
  TenantResolutionInput,
  TenantResolutionResult,
  TenantResolutionStrategy,
} from './types';
