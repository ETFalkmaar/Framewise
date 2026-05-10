import { describe, expect, it } from 'vitest';
import { OG_IMAGE_DIMENSIONS, defaultOgImage, resolveOgImage } from '../og-image';

describe('og-image', () => {
  it('exports the standard 1200x630 OG dimensions', () => {
    expect(OG_IMAGE_DIMENSIONS).toEqual({ width: 1200, height: 630 });
  });

  it('uses the page-level OG image when set', () => {
    const url = resolveOgImage({
      pageOgImage: 'https://example.com/page.jpg',
      siteOgImage: 'https://example.com/site.jpg',
      firstImageInBlocks: 'https://example.com/block.jpg',
      tenantSlug: 'demo',
    });
    expect(url).toBe('https://example.com/page.jpg');
  });

  it('falls back to the site (tenant) OG image when page is missing', () => {
    const url = resolveOgImage({
      pageOgImage: null,
      siteOgImage: 'https://example.com/site.jpg',
      firstImageInBlocks: 'https://example.com/block.jpg',
      tenantSlug: 'demo',
    });
    expect(url).toBe('https://example.com/site.jpg');
  });

  it('falls back to the first block image when neither page nor site is set', () => {
    const url = resolveOgImage({
      pageOgImage: null,
      siteOgImage: null,
      firstImageInBlocks: 'https://example.com/block.jpg',
      tenantSlug: 'demo',
    });
    expect(url).toBe('https://example.com/block.jpg');
  });

  it('returns the Picsum default keyed on the tenant slug when nothing else is set', () => {
    const url = resolveOgImage({
      pageOgImage: null,
      siteOgImage: null,
      firstImageInBlocks: null,
      tenantSlug: 'demo-villa',
    });
    expect(url).toBe('https://picsum.photos/seed/demo-villa/1200/630');
  });

  it('treats whitespace-only strings as missing in the fallback chain', () => {
    const url = resolveOgImage({
      pageOgImage: '   ',
      siteOgImage: 'https://example.com/site.jpg',
      firstImageInBlocks: null,
      tenantSlug: 'demo',
    });
    expect(url).toBe('https://example.com/site.jpg');
  });

  it('trims trailing whitespace from the chosen URL', () => {
    const url = resolveOgImage({
      pageOgImage: '  https://example.com/page.jpg  ',
      siteOgImage: null,
      firstImageInBlocks: null,
      tenantSlug: 'demo',
    });
    expect(url).toBe('https://example.com/page.jpg');
  });

  it('defaultOgImage normalises slugs containing whitespace', () => {
    expect(defaultOgImage('Some Slug')).toBe('https://picsum.photos/seed/some-slug/1200/630');
  });

  it('defaultOgImage falls back to "framewise" when slug is empty', () => {
    expect(defaultOgImage('')).toBe('https://picsum.photos/seed/framewise/1200/630');
  });
});
