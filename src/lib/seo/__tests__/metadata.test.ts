import { describe, expect, it } from 'vitest';
import type { Page, Tenant } from '@/types/database';
import type { ContentBlock, Locale } from '@/lib/blocks/types';
import type { ResolvedPage } from '@/lib/public-site/resolve-page';

import {
  buildPageMetadata,
  extractPageDescription,
  extractPageTitle,
} from '../metadata';

const BASE_URL = 'https://framewise-pi.vercel.app';
const ALL_LOCALES: Locale[] = ['nl', 'fr', 'en'];

const TENANT: Tenant = {
  id: 't-villa',
  slug: 'demo-villa',
  name: 'Demo Villa Curaçao',
  country: 'CW',
  vat_number: null,
  crib_number: null,
  subscription_plan_id: 'plan-1',
  status: 'live',
  custom_domain: null,
  default_locale: 'en',
  enabled_locales: ['en', 'nl', 'fr'],
  og_image_url: 'https://example.com/site-og.jpg',
  organization_type: 'LodgingBusiness',
  twitter_handle: 'framewise_app',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const PAGE: Page = {
  id: 'p-home',
  tenant_id: TENANT.id,
  slug: 'home',
  status: 'published',
  parent_id: null,
  order_index: 0,
  seo_meta: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  published_at: '2026-01-01T00:00:00.000Z',
};

function makeResolved(overrides: Partial<ResolvedPage> = {}): ResolvedPage {
  return {
    tenant: TENANT,
    page: PAGE,
    blocks: [],
    locale: 'nl',
    defaultLocale: 'en',
    ...overrides,
  };
}

const HERO_BLOCK: ContentBlock = {
  id: 'b-hero',
  position: 0,
  type: 'hero',
  props: {
    headline_translations: { nl: 'Welkom op de villa', en: 'Welcome to the villa' },
    image_url: 'https://example.com/hero.jpg',
  },
};

const TEXT_BLOCK: ContentBlock = {
  id: 'b-text',
  position: 1,
  type: 'text',
  props: {
    content_translations: {
      nl: 'Een prachtige villa direct aan zee, met privézwembad en chef op afroep.',
      en: 'A beautiful beachfront villa with private pool and chef on call.',
    },
  },
};

describe('extractPageTitle', () => {
  it('uses seo_meta override when available', () => {
    const resolved = makeResolved({
      page: { ...PAGE, seo_meta: { title_translations: { nl: 'Custom Title' } } },
    });
    expect(extractPageTitle(resolved, 'nl')).toBe('Custom Title');
  });

  it('falls back to the first hero block headline', () => {
    const resolved = makeResolved({ blocks: [HERO_BLOCK], locale: 'nl' });
    expect(extractPageTitle(resolved, 'nl')).toBe('Welkom op de villa');
  });

  it('uses defaultLocale when the requested locale is missing on the hero', () => {
    const resolved = makeResolved({
      blocks: [
        {
          ...HERO_BLOCK,
          props: { headline_translations: { en: 'English only' } },
        } as ContentBlock,
      ],
      locale: 'fr',
      defaultLocale: 'en',
    });
    expect(extractPageTitle(resolved, 'fr')).toBe('English only');
  });

  it('falls back to tenant.name when no hero exists', () => {
    const resolved = makeResolved({ blocks: [], locale: 'nl' });
    expect(extractPageTitle(resolved, 'nl')).toBe('Demo Villa Curaçao');
  });
});

describe('extractPageDescription', () => {
  it('uses seo_meta override when available', () => {
    const resolved = makeResolved({
      page: {
        ...PAGE,
        seo_meta: { description_translations: { nl: 'Korte beschrijving.' } },
      },
    });
    expect(extractPageDescription(resolved, 'nl')).toBe('Korte beschrijving.');
  });

  it('falls back to the first text block content', () => {
    const resolved = makeResolved({ blocks: [TEXT_BLOCK], locale: 'nl' });
    expect(extractPageDescription(resolved, 'nl')).toMatch(/^Een prachtige villa/);
  });

  it('truncates text content at 160 chars with an ellipsis', () => {
    const long = 'a'.repeat(300);
    const resolved = makeResolved({
      blocks: [
        {
          ...TEXT_BLOCK,
          props: { content_translations: { nl: long } },
        } as ContentBlock,
      ],
      locale: 'nl',
    });
    const desc = extractPageDescription(resolved, 'nl');
    expect(desc.length).toBe(160);
    expect(desc.endsWith('…')).toBe(true);
  });
});

describe('buildPageMetadata', () => {
  it('sets title from hero block headline', () => {
    const resolved = makeResolved({ blocks: [HERO_BLOCK] });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
      allLocales: ALL_LOCALES,
    });
    expect(meta.title).toBe('Welkom op de villa');
  });

  it('falls back title to tenant.name when no blocks are present', () => {
    const resolved = makeResolved({ blocks: [] });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
      allLocales: ALL_LOCALES,
    });
    expect(meta.title).toBe('Demo Villa Curaçao');
  });

  it('truncates long text-block descriptions to 160 chars', () => {
    const long = 'word '.repeat(80);
    const resolved = makeResolved({
      blocks: [
        {
          ...TEXT_BLOCK,
          props: { content_translations: { nl: long } },
        } as ContentBlock,
      ],
    });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
      allLocales: ALL_LOCALES,
    });
    expect(meta.description?.length).toBeLessThanOrEqual(160);
  });

  it('uses resolveOgImage in the right order: page → site → block → fallback', () => {
    const resolved = makeResolved({
      page: { ...PAGE, seo_meta: { og_image_url: 'https://example.com/page-og.jpg' } },
      blocks: [HERO_BLOCK],
    });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
      allLocales: ALL_LOCALES,
    });
    const images = meta.openGraph?.images;
    expect(Array.isArray(images) ? images[0] : images).toMatchObject({
      url: 'https://example.com/page-og.jpg',
      width: 1200,
      height: 630,
    });
  });

  it('formats og:locale per locale (nl→nl_NL, fr→fr_FR, en→en_US)', () => {
    const resolved = makeResolved({ blocks: [HERO_BLOCK] });
    const nlMeta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/',
      allLocales: ALL_LOCALES,
    });
    const frMeta = buildPageMetadata({
      resolved,
      locale: 'fr',
      baseUrl: BASE_URL,
      pathname: '/',
      allLocales: ALL_LOCALES,
    });
    const enMeta = buildPageMetadata({
      resolved,
      locale: 'en',
      baseUrl: BASE_URL,
      pathname: '/',
      allLocales: ALL_LOCALES,
    });
    expect(nlMeta.openGraph?.locale).toBe('nl_NL');
    expect(frMeta.openGraph?.locale).toBe('fr_FR');
    expect(enMeta.openGraph?.locale).toBe('en_US');
  });

  it('sets twitter card to summary_large_image', () => {
    const resolved = makeResolved({ blocks: [HERO_BLOCK] });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
      allLocales: ALL_LOCALES,
    });
    expect((meta.twitter as { card: string }).card).toBe('summary_large_image');
  });

  it('adds twitter:creator with @ prefix when handle is present', () => {
    const resolved = makeResolved({ blocks: [HERO_BLOCK] });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
      allLocales: ALL_LOCALES,
    });
    expect((meta.twitter as { creator?: string }).creator).toBe('@framewise_app');
  });

  it('omits twitter:creator when handle is null', () => {
    const resolved = makeResolved({
      tenant: { ...TENANT, twitter_handle: null },
      blocks: [HERO_BLOCK],
    });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
      allLocales: ALL_LOCALES,
    });
    expect((meta.twitter as { creator?: string }).creator).toBeUndefined();
  });

  it('alternates.languages contains all 3 locales', () => {
    const resolved = makeResolved({ blocks: [HERO_BLOCK] });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
      allLocales: ALL_LOCALES,
    });
    const langs = meta.alternates?.languages ?? {};
    expect(Object.keys(langs).sort()).toEqual(['en-US', 'fr-FR', 'nl-NL']);
  });

  it('sets canonical URL with locale prefix when locale is not default (nl)', () => {
    const resolved = makeResolved({ blocks: [HERO_BLOCK] });
    const enMeta = buildPageMetadata({
      resolved,
      locale: 'en',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
      allLocales: ALL_LOCALES,
    });
    expect(enMeta.alternates?.canonical).toBe(`${BASE_URL}/en/sites/demo-villa`);
  });

  it('sets canonical URL without locale prefix for the default locale (nl)', () => {
    const resolved = makeResolved({ blocks: [HERO_BLOCK] });
    const nlMeta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
      allLocales: ALL_LOCALES,
    });
    expect(nlMeta.alternates?.canonical).toBe(`${BASE_URL}/sites/demo-villa`);
  });

  it('robots is index/follow for normal published pages', () => {
    const resolved = makeResolved({ blocks: [HERO_BLOCK] });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/',
      allLocales: ALL_LOCALES,
    });
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it('robots is noindex/nofollow when seo_meta.noindex is true', () => {
    const resolved = makeResolved({
      page: { ...PAGE, seo_meta: { noindex: true } },
      blocks: [HERO_BLOCK],
    });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/',
      allLocales: ALL_LOCALES,
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it('uses canonical_path override when provided', () => {
    const resolved = makeResolved({
      page: { ...PAGE, seo_meta: { canonical_path: '/canonical-path' } },
      blocks: [HERO_BLOCK],
    });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa/get-in-touch',
      allLocales: ALL_LOCALES,
    });
    expect(meta.alternates?.canonical).toBe(`${BASE_URL}/canonical-path`);
  });

  it('languages map URLs use the right locale prefixes (nl no prefix, fr/en prefixed)', () => {
    const resolved = makeResolved({ blocks: [HERO_BLOCK] });
    const meta = buildPageMetadata({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/over-ons',
      allLocales: ALL_LOCALES,
    });
    const langs = meta.alternates?.languages as Record<string, string>;
    expect(langs['nl-NL']).toBe(`${BASE_URL}/over-ons`);
    expect(langs['fr-FR']).toBe(`${BASE_URL}/fr/over-ons`);
    expect(langs['en-US']).toBe(`${BASE_URL}/en/over-ons`);
  });
});
