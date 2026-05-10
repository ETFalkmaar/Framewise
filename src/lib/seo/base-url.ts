/**
 * Resolve the absolute base URL Next.js should use when emitting
 * canonical/og:url/JSON-LD URLs (step 26).
 *
 *   1. `NEXT_PUBLIC_BASE_URL`         — explicit override; deploys
 *      that need a real custom domain set this.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — set on Vercel production
 *      builds; we prepend `https://`.
 *   3. `VERCEL_URL`                   — set on Vercel preview
 *      builds; same treatment.
 *   4. `http://localhost:3000`        — dev/test fallback.
 *
 * Always returns a value with no trailing slash so callers can
 * concatenate `${baseUrl}${pathname}` without thinking.
 */
export function resolveBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit && explicit.length > 0) return stripTrailing(explicit);

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd && vercelProd.length > 0) return `https://${stripTrailing(vercelProd)}`;

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && vercelUrl.length > 0) return `https://${stripTrailing(vercelUrl)}`;

  return 'http://localhost:3000';
}

function stripTrailing(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
