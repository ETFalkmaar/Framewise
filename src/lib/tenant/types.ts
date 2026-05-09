/**
 * Shared types for the multi-tenant resolver.
 *
 * The resolver consumes a `(hostname, pathname)` pair and returns the
 * tenant id (or null) plus metadata about which strategy matched.
 */

export type TenantResolutionStrategy = 'custom-domain' | 'subdomain' | 'path-prefix' | 'none';

export interface TenantResolutionInput {
  hostname: string;
  pathname: string;
}

export interface TenantResolutionResult {
  tenantId: string | null;
  strategy: TenantResolutionStrategy;
  /** For path-prefix: pathname stripped of `/sites/<slug>` (e.g. `/about`). */
  residualPath?: string;
  /** For subdomain/path-prefix: the slug that matched, useful for logging. */
  matchedSlug?: string;
}

/** Hosts that should never be treated as a custom domain. */
export const FRAMEWISE_ROOT_HOSTS = [
  'framewise.app',
  'framewise-pi.vercel.app',
  'framewise-etfalkmaars-projects.vercel.app',
] as const;

/** Hostname suffixes that signal a Vercel preview / dev / system host. */
export const NON_CUSTOM_HOST_SUFFIXES = ['.vercel.app', '.localhost', 'localhost'] as const;

export function stripPort(hostname: string): string {
  const colon = hostname.indexOf(':');
  return colon === -1 ? hostname : hostname.slice(0, colon);
}
