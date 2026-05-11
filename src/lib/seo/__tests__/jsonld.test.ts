import { describe, expect, it } from 'vitest';
import type { Page, Tenant } from '@/types/database';
import type { ContentBlock, Locale } from '@/lib/blocks/types';
import type { ResolvedPage } from '@/lib/public-site/resolve-page';

import { buildOrganizationLD, buildWebPageLD } from '../jsonld';

const BASE_URL = 'https://framewise-pi.vercel.app';

const VILLA: Tenant = {
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
  og_image_url: 'https://example.com/villa-og.jpg',
  organization_type: 'LodgingBusiness',
  twitter_handle: 'framewise_app',
  maintenance_message_translations: null,
  maintenance_logo_url: null,
  maintenance_contact_email: null,
  publish_request_status: 'none',
  publish_requested_at: null,
  publish_requested_by_user_id: null,
  publish_approval_notes: null,
  publish_approved_at: null,
  publish_approved_by_user_id: null,
  publish_rejected_at: null,
  publish_rejected_by_user_id: null,
  bookings_enabled: false,
  booking_timezone: null,
  calendar_feed_token: null,
  ai_agent_enabled: false,
  ai_agent_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const RESTAURANT: Tenant = {
  ...VILLA,
  id: 't-restaurant',
  slug: 'demo-restaurant',
  name: 'Demo Restaurant Amsterdam',
  country: 'NL',
  default_locale: 'nl',
  enabled_locales: ['nl', 'en'],
  organization_type: 'Restaurant',
  twitter_handle: null,
};

const GENERIC_TENANT: Tenant = {
  ...VILLA,
  id: 't-generic',
  slug: 'generic',
  name: 'Generic Co',
  organization_type: null,
};

const PAGE: Page = {
  id: 'p-home',
  tenant_id: VILLA.id,
  slug: 'home',
  status: 'published',
  parent_id: null,
  order_index: 0,
  seo_meta: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  published_at: '2026-01-01T00:00:00.000Z',
};

const HERO_BLOCK: ContentBlock = {
  id: 'b-hero',
  position: 0,
  type: 'hero',
  props: {
    headline_translations: { nl: 'Welkom', en: 'Welcome' },
  },
};

function makeResolved(tenant: Tenant, locale: Locale, blocks: ContentBlock[] = []): ResolvedPage {
  return {
    tenant,
    page: { ...PAGE, tenant_id: tenant.id },
    blocks,
    locale,
    defaultLocale: tenant.default_locale as Locale,
  };
}

describe('buildOrganizationLD', () => {
  it('uses Organization as default @type when tenant.organization_type is null', () => {
    const ld = buildOrganizationLD({ tenant: GENERIC_TENANT, baseUrl: BASE_URL });
    expect(ld['@type']).toBe('Organization');
  });

  it('uses LodgingBusiness for villa tenants', () => {
    const ld = buildOrganizationLD({ tenant: VILLA, baseUrl: BASE_URL });
    expect(ld['@type']).toBe('LodgingBusiness');
  });

  it('uses Restaurant for restaurant tenants', () => {
    const ld = buildOrganizationLD({ tenant: RESTAURANT, baseUrl: BASE_URL });
    expect(ld['@type']).toBe('Restaurant');
  });

  it('sets name + url + image correctly', () => {
    const ld = buildOrganizationLD({ tenant: VILLA, baseUrl: BASE_URL });
    expect(ld.name).toBe('Demo Villa Curaçao');
    expect(ld.url).toBe(BASE_URL);
    expect(ld.image).toBe('https://example.com/villa-og.jpg');
  });

  it('uses Picsum fallback image when tenant.og_image_url is null', () => {
    const ld = buildOrganizationLD({
      tenant: { ...VILLA, og_image_url: null },
      baseUrl: BASE_URL,
    });
    expect(ld.image).toBe('https://picsum.photos/seed/demo-villa/1200/630');
  });

  it('sets address.addressCountry to NL for restaurant', () => {
    const ld = buildOrganizationLD({ tenant: RESTAURANT, baseUrl: BASE_URL });
    expect(ld.address).toMatchObject({
      '@type': 'PostalAddress',
      addressCountry: 'NL',
    });
  });

  it('sets address.addressCountry to CW for villa', () => {
    const ld = buildOrganizationLD({ tenant: VILLA, baseUrl: BASE_URL });
    expect(ld.address).toMatchObject({
      '@type': 'PostalAddress',
      addressCountry: 'CW',
    });
  });

  it('adds sameAs with twitter URL when handle is present', () => {
    const ld = buildOrganizationLD({ tenant: VILLA, baseUrl: BASE_URL });
    expect(ld.sameAs).toEqual(['https://twitter.com/framewise_app']);
  });

  it('omits sameAs when twitter_handle is null', () => {
    const ld = buildOrganizationLD({ tenant: RESTAURANT, baseUrl: BASE_URL });
    expect(ld.sameAs).toBeUndefined();
  });
});

describe('buildWebPageLD', () => {
  it('sets name and description from page metadata helpers', () => {
    const resolved = makeResolved(VILLA, 'nl', [HERO_BLOCK]);
    const ld = buildWebPageLD({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
    });
    expect(ld.name).toBe('Welkom');
    expect(typeof ld.description).toBe('string');
  });

  it('formats inLanguage for nl', () => {
    const resolved = makeResolved(VILLA, 'nl', [HERO_BLOCK]);
    const ld = buildWebPageLD({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/',
    });
    expect(ld.inLanguage).toBe('nl-NL');
  });

  it('formats inLanguage for fr', () => {
    const resolved = makeResolved(VILLA, 'fr', [HERO_BLOCK]);
    const ld = buildWebPageLD({
      resolved,
      locale: 'fr',
      baseUrl: BASE_URL,
      pathname: '/',
    });
    expect(ld.inLanguage).toBe('fr-FR');
  });

  it('formats inLanguage for en', () => {
    const resolved = makeResolved(VILLA, 'en', [HERO_BLOCK]);
    const ld = buildWebPageLD({
      resolved,
      locale: 'en',
      baseUrl: BASE_URL,
      pathname: '/',
    });
    expect(ld.inLanguage).toBe('en-US');
  });

  it('isPartOf points at the WebSite node for the tenant homepage', () => {
    const resolved = makeResolved(VILLA, 'nl', [HERO_BLOCK]);
    const ld = buildWebPageLD({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa/over-ons',
    });
    expect(ld.isPartOf).toMatchObject({
      '@type': 'WebSite',
      name: 'Demo Villa Curaçao',
      url: BASE_URL + '/',
    });
  });

  it('url uses the locale prefix for non-default locales', () => {
    const resolved = makeResolved(VILLA, 'en', [HERO_BLOCK]);
    const ld = buildWebPageLD({
      resolved,
      locale: 'en',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-villa',
    });
    expect(ld.url).toBe(`${BASE_URL}/en/sites/demo-villa`);
  });

  it('url omits the locale prefix for the default (nl) locale', () => {
    const resolved = makeResolved(RESTAURANT, 'nl', [HERO_BLOCK]);
    const ld = buildWebPageLD({
      resolved,
      locale: 'nl',
      baseUrl: BASE_URL,
      pathname: '/sites/demo-restaurant',
    });
    expect(ld.url).toBe(`${BASE_URL}/sites/demo-restaurant`);
  });
});
