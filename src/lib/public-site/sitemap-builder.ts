import type { MetadataRoute } from 'next';

import { pagesRepo, tenantsRepo } from '@/lib/data';
import type { Locale } from '@/lib/blocks/types';

/**
 * Build a Next.js `MetadataRoute.Sitemap` array for one tenant
 * (step 27).
 *
 * One entry per published page. The entry's `url` is the page's
 * default-locale URL; `alternates.languages` lists the same page
 * in every other locale the tenant has enabled. The locale prefix
 * rule mirrors `src/i18n/routing.ts` ('as-needed'): the routing
 * default (`nl`) renders without a path prefix; `fr` and `en`
 * render with `/fr/` or `/en/`.
 *
 * Pages are skipped when:
 *  - `status` is anything other than `'published'` (drafts and
 *    archived pages must not be crawled).
 *  - `seo_meta.noindex` is `true` (operator opt-out).
 *
 * Returns an empty array when the tenant doesn't exist — keeps
 * the sitemap route 200-but-empty rather than 500 when a stale
 * tenant id is requested.
 */
export interface SitemapBuilderInput {
  tenantId: string;
  /** Origin without trailing slash, e.g. `https://framewise-pi.vercel.app`. */
  baseUrl: string;
  /** Locales to emit in `alternates.languages`. Order is preserved. */
  allLocales: Locale[];
  /**
   * Optional path prefix prepended to every URL. Used by the
   * path-prefix preview routes — for `/sites/demo-villa` pass
   * `'/sites/demo-villa'`. Pass `''` (or omit) for subdomain /
   * custom-domain tenants where pages live at the root.
   */
  pathPrefix?: string;
}

/** Routing default locale — must match `src/i18n/routing.ts`. */
const DEFAULT_LOCALE: Locale = 'nl';

/** `nl` → `nl-NL`, etc. Used as the key in `alternates.languages`. */
const HTML_LANG_MAP: Record<Locale, string> = {
  nl: 'nl-NL',
  fr: 'fr-FR',
  en: 'en-US',
};

export async function buildSitemap(input: SitemapBuilderInput): Promise<MetadataRoute.Sitemap> {
  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return [];

  const pages = await pagesRepo.listByTenant(input.tenantId);
  const pathPrefix = normalisePathPrefix(input.pathPrefix);

  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    if (page.status !== 'published') continue;
    if (page.seo_meta?.noindex === true) continue;

    const isHome = page.slug === 'home';
    const url = buildPageUrl({
      baseUrl: input.baseUrl,
      pathPrefix,
      pageSlug: isHome ? '' : page.slug,
      locale: DEFAULT_LOCALE,
    });

    const alternates: Record<string, string> = {};
    for (const locale of input.allLocales) {
      alternates[HTML_LANG_MAP[locale]] = buildPageUrl({
        baseUrl: input.baseUrl,
        pathPrefix,
        pageSlug: isHome ? '' : page.slug,
        locale,
      });
    }

    entries.push({
      url,
      lastModified: new Date(page.updated_at),
      changeFrequency: isHome ? 'daily' : 'weekly',
      priority: isHome ? 1.0 : 0.8,
      alternates: { languages: alternates },
    });
  }

  return entries;
}

/**
 * Build the full URL for a page in a specific locale. Mirrors the
 * `localePrefix: 'as-needed'` rule from `src/i18n/routing.ts`:
 * default locale (`nl`) gets no prefix; everything else does.
 */
export function buildPageUrl(input: {
  baseUrl: string;
  pathPrefix: string;
  /** `''` = homepage; otherwise the page slug (no leading slash). */
  pageSlug: string;
  locale: Locale;
}): string {
  const localePrefix = input.locale === DEFAULT_LOCALE ? '' : `/${input.locale}`;
  const slugPart = input.pageSlug ? `/${input.pageSlug}` : '';
  const base = stripTrailing(input.baseUrl);
  const pathPart = `${localePrefix}${input.pathPrefix}${slugPart}`;
  return pathPart === '' ? `${base}/` : `${base}${pathPart}`;
}

function normalisePathPrefix(pathPrefix?: string): string {
  if (!pathPrefix) return '';
  let p = pathPrefix.startsWith('/') ? pathPrefix : `/${pathPrefix}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function stripTrailing(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
