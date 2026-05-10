import type { MetadataRoute } from 'next';

import { tenantsRepo } from '@/lib/data';
import { getCurrentTenant } from '@/lib/tenant';
import type { Locale } from '@/lib/blocks/types';
import { buildSitemap } from '@/lib/public-site/sitemap-builder';
import { resolveBaseUrl } from '@/lib/seo/base-url';

const ALL_LOCALES: Locale[] = ['nl', 'fr', 'en'];

/**
 * Top-level dynamic sitemap (`/sitemap.xml`) — step 27.
 *
 * Tenant resolution:
 *  - When the request resolves a tenant via the
 *    subdomain/custom-domain middleware (sets
 *    `x-framewise-tenant-id`), emit that tenant's published pages
 *    at the request origin — pages live at the root.
 *  - Otherwise (the marketing host `framewise-pi.vercel.app`),
 *    fall back to the canonical `demo-villa` tenant and emit its
 *    pages under the `/sites/demo-villa` path-prefix. Per-tenant
 *    sitemaps on the marketing host arrive in the domain wizard
 *    (fase 10, step 33).
 *
 * Cache for 60 s so a fresh page publish surfaces in the sitemap
 * within the next minute, but we don't pay the database round-trip
 * on every crawler request.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = resolveBaseUrl();
  const requestTenant = await getCurrentTenant();
  const tenant = requestTenant ?? (await tenantsRepo.findBySlug('demo-villa'));
  if (!tenant) return [];

  const pathPrefix = requestTenant ? '' : `/sites/${tenant.slug}`;

  return buildSitemap({
    tenantId: tenant.id,
    baseUrl,
    allLocales: ALL_LOCALES,
    pathPrefix,
  });
}

export const revalidate = 60;
