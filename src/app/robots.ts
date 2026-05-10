import type { MetadataRoute } from 'next';

import { buildRobots } from '@/lib/public-site/robots-builder';
import { resolveBaseUrl } from '@/lib/seo/base-url';

/**
 * Top-level dynamic robots.txt (`/robots.txt`) — step 27.
 *
 * Allows the public renderer; disallows auth-required admin
 * (`/account/`), the raw API surface (`/api/`), the dev-only
 * inspection UI (`/debug/`), and the standalone login page. Adds a
 * `Sitemap:` line pointing at the dynamic sitemap so crawlers can
 * discover all published pages.
 */
export default function robots(): MetadataRoute.Robots {
  return buildRobots({ baseUrl: resolveBaseUrl() });
}
