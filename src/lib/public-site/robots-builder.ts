import type { MetadataRoute } from 'next';

/**
 * Build a Next.js `MetadataRoute.Robots` payload for the public
 * `/robots.txt` endpoint (step 27).
 *
 * Allows everything by default; disallows the auth-required admin,
 * raw API endpoints, dev-only debug routes, and the standalone
 * login page. The auth-required pages already 302 visitors back to
 * `/login`, but blocking them at the crawler level avoids wasted
 * crawl budget. The login page itself is hidden because it carries
 * no useful indexable content.
 */
export interface RobotsBuilderInput {
  /** Origin without a trailing slash, e.g. `https://framewise-pi.vercel.app`. */
  baseUrl: string;
  /** Default `true` — emit a `Sitemap:` line pointing at `<baseUrl>/sitemap.xml`. */
  includeSitemap?: boolean;
}

/** Path prefixes the public crawler should never follow. */
export const ROBOTS_DISALLOW_PATHS: readonly string[] = ['/account/', '/api/', '/debug/', '/login'];

export function buildRobots(input: RobotsBuilderInput): MetadataRoute.Robots {
  const includeSitemap = input.includeSitemap !== false;
  const baseUrl = stripTrailing(input.baseUrl);

  const result: MetadataRoute.Robots = {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...ROBOTS_DISALLOW_PATHS],
    },
    host: baseUrl,
  };

  if (includeSitemap) {
    result.sitemap = `${baseUrl}/sitemap.xml`;
  }

  return result;
}

function stripTrailing(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
