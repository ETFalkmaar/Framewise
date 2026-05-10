import type { OrganizationType, Tenant } from '@/types/database';
import type { Locale } from '@/lib/blocks/types';

import type { ResolvedPage } from '@/lib/public-site/resolve-page';

import { extractPageDescription, extractPageTitle } from './metadata';
import { resolveOgImage } from './og-image';

/**
 * Map ISO 3166-1 alpha-2 country codes to schema.org-compatible
 * `addressCountry` values. Step 26 only ships NL/CW (the two
 * Framewise tenant countries) — extend as needed.
 */
const COUNTRY_TO_ADDRESS_COUNTRY: Record<string, string> = {
  NL: 'NL',
  CW: 'CW',
};

const HTML_LANG_MAP: Record<Locale, string> = {
  nl: 'nl-NL',
  fr: 'fr-FR',
  en: 'en-US',
};

const DEFAULT_LOCALE: Locale = 'nl';

export interface OrganizationLDInput {
  tenant: Tenant;
  baseUrl: string;
}

/**
 * Build a schema.org `Organization` (or vertical subtype) JSON-LD
 * payload. Used in `<script type="application/ld+json">` once per
 * page.
 */
export function buildOrganizationLD(input: OrganizationLDInput): Record<string, unknown> {
  const { tenant, baseUrl } = input;
  const type: OrganizationType = tenant.organization_type ?? 'Organization';
  const url = stripTrailingSlash(baseUrl);
  const image = resolveOgImage({
    pageOgImage: null,
    siteOgImage: tenant.og_image_url,
    firstImageInBlocks: null,
    tenantSlug: tenant.slug,
  });

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
    name: tenant.name,
    url,
    image,
    logo: image,
    address: {
      '@type': 'PostalAddress',
      addressCountry: COUNTRY_TO_ADDRESS_COUNTRY[tenant.country] ?? tenant.country,
    },
  };

  if (tenant.twitter_handle) {
    ld.sameAs = [`https://twitter.com/${tenant.twitter_handle}`];
  }

  return ld;
}

export interface WebPageLDInput {
  resolved: ResolvedPage;
  locale: Locale;
  baseUrl: string;
  pathname: string;
}

/**
 * Build a schema.org `WebPage` JSON-LD payload that links back to a
 * `WebSite` representing the tenant homepage. Title/description run
 * through the same resolution chain as the meta tags so the JSON-LD
 * never disagrees with what's in `<head>`.
 */
export function buildWebPageLD(input: WebPageLDInput): Record<string, unknown> {
  const { resolved, locale, baseUrl, pathname } = input;
  const { tenant } = resolved;

  const title = extractPageTitle(resolved, locale);
  const description = extractPageDescription(resolved, locale);

  const cleanPath = normalisePath(resolved.page.seo_meta?.canonical_path ?? pathname);
  const pageUrl = buildLocaleUrl(baseUrl, locale, cleanPath);
  const homeUrl = buildLocaleUrl(baseUrl, locale, '/');

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: pageUrl,
    inLanguage: HTML_LANG_MAP[locale],
    isPartOf: {
      '@type': 'WebSite',
      name: tenant.name,
      url: homeUrl,
    },
  };
}

function localePathPrefix(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

function buildLocaleUrl(baseUrl: string, locale: Locale, pathname: string): string {
  return `${stripTrailingSlash(baseUrl)}${localePathPrefix(locale)}${pathname}`;
}

function normalisePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  let p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
