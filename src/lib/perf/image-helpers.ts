/**
 * `next/image` configuration helpers (step 29, closes fase 9).
 *
 * Centralises the responsive `sizes` strings and the blur-up
 * placeholder URL builder so every block component speaks the same
 * dialect. Picsum supports the `/10/10` low-res endpoint, which is
 * cheap enough to inline as a placeholder while the real image
 * decodes.
 */

/**
 * Responsive `sizes` presets the renderer hands to `next/image`.
 * Picking the right one means the CDN serves an appropriately
 * sized variant on each viewport — half the bytes of a wrong one.
 */
export const IMAGE_SIZES = {
  /** Full-bleed hero / page-wide image. */
  HERO_FULL: '100vw',
  /** Wide content image (e.g. `image` block when `full_width`). */
  CONTENT_WIDE: '(max-width: 768px) 100vw, 1200px',
  /** Narrow content image (default `image` block). */
  CONTENT_NARROW: '(max-width: 768px) 100vw, 800px',
  /** Gallery grid 2 cols. */
  GALLERY_GRID_2: '(max-width: 640px) 100vw, 50vw',
  /** Gallery grid 3 cols (default). */
  GALLERY_GRID_3: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  /** Gallery grid 4 cols. */
  GALLERY_GRID_4: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  /** Square thumbnail. */
  THUMBNAIL: '(max-width: 768px) 50vw, 200px',
} as const;

export type ImageSizesPreset = (typeof IMAGE_SIZES)[keyof typeof IMAGE_SIZES];

/**
 * Tiny placeholder URL for the blur-up effect. Picsum URLs swap
 * their dimensions for `/10/10` (a 10×10 thumbnail loads in a few
 * KB and `next/image` blurs it for us). Non-Picsum URLs return
 * `undefined` so the caller can fall back to no placeholder rather
 * than emitting a broken `<img>`.
 *
 * Examples:
 *  - `https://picsum.photos/1200/630` → `https://picsum.photos/10/10`
 *  - `https://picsum.photos/seed/foo/1200/630` →
 *    `https://picsum.photos/seed/foo/10/10`
 *  - `https://example.com/photo.jpg` → `undefined`
 */
export function getBlurDataUrl(imageUrl: string): string | undefined {
  if (!imageUrl) return undefined;
  if (!imageUrl.includes('picsum.photos')) return undefined;

  const dimensionsRe = /\/\d+\/\d+(\?|$)/;
  if (!dimensionsRe.test(imageUrl)) return undefined;

  return imageUrl.replace(dimensionsRe, '/10/10$1');
}

/**
 * Returns `true` for the image that should claim `priority` /
 * `fetchPriority="high"` on `next/image`. Today: only the hero
 * block at `position === 0` (the LCP candidate on every public
 * page). Other blocks lazy-load.
 */
export function shouldPrioritizeImage(blockType: string, position: number): boolean {
  return blockType === 'hero' && position === 0;
}

/**
 * Pick a `sizes` preset for a gallery block based on its column
 * count. Defaults to the 3-column preset, which matches the
 * gallery component's default layout.
 */
export function galleryGridSizes(columns: 2 | 3 | 4 | undefined): string {
  switch (columns) {
    case 2:
      return IMAGE_SIZES.GALLERY_GRID_2;
    case 4:
      return IMAGE_SIZES.GALLERY_GRID_4;
    case 3:
    default:
      return IMAGE_SIZES.GALLERY_GRID_3;
  }
}
