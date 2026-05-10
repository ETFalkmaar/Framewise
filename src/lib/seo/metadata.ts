import type { Metadata } from 'next';

import { getTranslatedString } from '@/lib/public-site/locale-fallback';
import type { ResolvedPage } from '@/lib/public-site/resolve-page';
import type { Locale } from '@/lib/blocks/types';

import { OG_IMAGE_DIMENSIONS, resolveOgImage } from './og-image';

/**
 * Routing config mirrors `src/i18n/routing.ts` — `nl` is the default
 * and renders without a path prefix; `fr` and `en` get prefixed.
 * Hard-coded here to avoid pulling next-intl into a server-only
 * helper that's also used from generateMetadata.
 */
const DEFAULT_LOCALE: Locale = 'nl';

/** OpenGraph locale codes (BCP-47-ish, with underscore). */
const OG_LOCALE_MAP: Record<Locale, string> = {
  nl: 'nl_NL',
  fr: 'fr_FR',
  en: 'en_US',
};

/** schema.org `inLanguage` codes (proper BCP-47 with hyphens). */
const HTML_LANG_MAP: Record<Locale, string> = {
  nl: 'nl-NL',
  fr: 'fr-FR',
  en: 'en-US',
};

const DESCRIPTION_MAX_LENGTH = 160;

export interface BuildMetadataInput {
  resolved: ResolvedPage;
  locale: Locale;
  /** e.g. `https://framewise-pi.vercel.app` (no trailing slash). */
  baseUrl: string;
  /**
   * Path **without** the locale prefix and **without** a trailing
   * slash, e.g. `/sites/demo-villa/over-ons` or `/over-ons`. The
   * helper adds the locale prefix when needed.
   */
  pathname: string;
  /** All locales the site supports — used to fill `alternates.languages`. */
  allLocales: Locale[];
}

/**
 * Build the full Next.js `Metadata` object for a public page.
 *
 * Title/description fall back through the chain:
 *   page seo_meta → first hero block headline → tenant.name
 *   page seo_meta → first text block content (≤160 chars) → tenant default
 *
 * `noindex` from `seo_meta.noindex` flips robots; otherwise we mark
 * published pages as indexable. Draft pages never reach this code
 * path because `resolvePage` rejects them.
 */
export function buildPageMetadata(input: BuildMetadataInput): Metadata {
  const { resolved, locale, baseUrl, pathname, allLocales } = input;
  const { tenant, page } = resolved;
  const seoMeta = page.seo_meta ?? null;

  const title = extractPageTitle(resolved, locale);
  const description = extractPageDescription(resolved, locale);

  const ogImage = resolveOgImage({
    pageOgImage: seoMeta?.og_image_url ?? null,
    siteOgImage: tenant.og_image_url,
    firstImageInBlocks: findFirstBlockImage(resolved),
    tenantSlug: tenant.slug,
  });

  const cleanPath = normalisePath(seoMeta?.canonical_path ?? pathname);
  const canonicalUrl = buildLocaleUrl(baseUrl, locale, cleanPath);
  const languageAlternates = buildLanguageAlternates(baseUrl, allLocales, cleanPath);

  const noindex = seoMeta?.noindex === true;

  return {
    title,
    description,
    metadataBase: safeUrl(baseUrl),
    alternates: {
      canonical: canonicalUrl,
      languages: languageAlternates,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      siteName: tenant.name,
      locale: OG_LOCALE_MAP[locale],
      images: [
        {
          url: ogImage,
          width: OG_IMAGE_DIMENSIONS.width,
          height: OG_IMAGE_DIMENSIONS.height,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
      ...(tenant.twitter_handle
        ? {
            creator: `@${tenant.twitter_handle}`,
            site: `@${tenant.twitter_handle}`,
          }
        : {}),
    },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

/**
 * Title resolution: page-level override → first hero headline →
 * tenant name. The hero lookup uses the locale fallback chain so
 * partially translated pages still pick up a real string.
 */
export function extractPageTitle(resolved: ResolvedPage, locale: Locale): string {
  const override = resolved.page.seo_meta?.title_translations;
  if (override) {
    const fromMeta = getTranslatedString(override, locale, resolved.defaultLocale);
    if (fromMeta) return fromMeta;
  }

  const heroHeadline = findHeroHeadline(resolved, locale);
  if (heroHeadline) return heroHeadline;

  return resolved.tenant.name;
}

/**
 * Description resolution: page-level override → first text block
 * content (truncated at 160 chars) → tenant name as a last resort.
 */
export function extractPageDescription(resolved: ResolvedPage, locale: Locale): string {
  const override = resolved.page.seo_meta?.description_translations;
  if (override) {
    const fromMeta = getTranslatedString(override, locale, resolved.defaultLocale);
    if (fromMeta) return truncate(fromMeta, DESCRIPTION_MAX_LENGTH);
  }

  const textContent = findFirstTextContent(resolved, locale);
  if (textContent) return truncate(textContent, DESCRIPTION_MAX_LENGTH);

  return resolved.tenant.name;
}

function findHeroHeadline(resolved: ResolvedPage, locale: Locale): string {
  for (const block of resolved.blocks) {
    if (block.type !== 'hero') continue;
    const headline = getTranslatedString(
      block.props.headline_translations,
      locale,
      resolved.defaultLocale
    );
    if (headline) return headline;
  }
  return '';
}

function findFirstTextContent(resolved: ResolvedPage, locale: Locale): string {
  for (const block of resolved.blocks) {
    if (block.type !== 'text') continue;
    const content = getTranslatedString(
      block.props.content_translations,
      locale,
      resolved.defaultLocale
    );
    if (content) return content;
  }
  return '';
}

function findFirstBlockImage(resolved: ResolvedPage): string | null {
  for (const block of resolved.blocks) {
    if (block.type === 'hero' && block.props.image_url) return block.props.image_url;
    if (block.type === 'image' && block.props.image_url) return block.props.image_url;
    if (block.type === 'gallery' && block.props.images.length > 0) {
      const first = block.props.images[0];
      if (first?.url) return first.url;
    }
  }
  return null;
}

function localePathPrefix(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

function buildLocaleUrl(baseUrl: string, locale: Locale, pathname: string): string {
  const prefix = localePathPrefix(locale);
  return `${stripTrailingSlash(baseUrl)}${prefix}${pathname}`;
}

function buildLanguageAlternates(
  baseUrl: string,
  locales: Locale[],
  pathname: string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of locales) {
    out[HTML_LANG_MAP[locale]] = buildLocaleUrl(baseUrl, locale, pathname);
  }
  return out;
}

/**
 * Normalise a pathname to start with `/` and have no trailing
 * slash (root `/` keeps its slash). Used so callers can pass
 * `'home'`, `'/home'`, or `'/home/'` interchangeably.
 */
function normalisePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  let p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function safeUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}
