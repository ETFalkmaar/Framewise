import { describe, expect, it } from 'vitest';

import {
  IMAGE_SIZES,
  galleryGridSizes,
  getBlurDataUrl,
  shouldPrioritizeImage,
} from '../image-helpers';

describe('IMAGE_SIZES', () => {
  it('exposes a preset for every supported layout', () => {
    expect(Object.keys(IMAGE_SIZES).sort()).toEqual([
      'CONTENT_NARROW',
      'CONTENT_WIDE',
      'GALLERY_GRID_2',
      'GALLERY_GRID_3',
      'GALLERY_GRID_4',
      'HERO_FULL',
      'THUMBNAIL',
    ]);
  });

  it('hero is plain 100vw', () => {
    expect(IMAGE_SIZES.HERO_FULL).toBe('100vw');
  });

  it('content presets break at the 768px tablet width', () => {
    expect(IMAGE_SIZES.CONTENT_WIDE).toContain('768px');
    expect(IMAGE_SIZES.CONTENT_NARROW).toContain('768px');
  });
});

describe('getBlurDataUrl', () => {
  it('rewrites a Picsum URL with explicit dimensions to /10/10', () => {
    expect(getBlurDataUrl('https://picsum.photos/1200/630')).toBe('https://picsum.photos/10/10');
  });

  it('rewrites a seeded Picsum URL', () => {
    expect(getBlurDataUrl('https://picsum.photos/seed/demo-villa-og/1200/630')).toBe(
      'https://picsum.photos/seed/demo-villa-og/10/10'
    );
  });

  it('preserves a query string after the dimensions', () => {
    expect(getBlurDataUrl('https://picsum.photos/seed/x/800/600?random=2')).toBe(
      'https://picsum.photos/seed/x/10/10?random=2'
    );
  });

  it('returns undefined for non-Picsum hosts', () => {
    expect(getBlurDataUrl('https://example.com/photo.jpg')).toBeUndefined();
  });

  it('returns undefined for a Picsum URL without dimensions', () => {
    // /id/237/ would need /WIDTH/HEIGHT to be a valid endpoint
    expect(getBlurDataUrl('https://picsum.photos/id/237')).toBeUndefined();
  });

  it('returns undefined for empty input', () => {
    expect(getBlurDataUrl('')).toBeUndefined();
  });
});

describe('shouldPrioritizeImage', () => {
  it('prioritises the hero block at position 0 (LCP candidate)', () => {
    expect(shouldPrioritizeImage('hero', 0)).toBe(true);
  });

  it('does not prioritise a hero further down the page', () => {
    expect(shouldPrioritizeImage('hero', 1)).toBe(false);
    expect(shouldPrioritizeImage('hero', 5)).toBe(false);
  });

  it('does not prioritise non-hero block types at any position', () => {
    expect(shouldPrioritizeImage('image', 0)).toBe(false);
    expect(shouldPrioritizeImage('gallery', 0)).toBe(false);
    expect(shouldPrioritizeImage('text', 0)).toBe(false);
  });
});

describe('galleryGridSizes', () => {
  it('returns the 3-column preset by default', () => {
    expect(galleryGridSizes(undefined)).toBe(IMAGE_SIZES.GALLERY_GRID_3);
    expect(galleryGridSizes(3)).toBe(IMAGE_SIZES.GALLERY_GRID_3);
  });

  it('matches each column count to its preset', () => {
    expect(galleryGridSizes(2)).toBe(IMAGE_SIZES.GALLERY_GRID_2);
    expect(galleryGridSizes(4)).toBe(IMAGE_SIZES.GALLERY_GRID_4);
  });
});
