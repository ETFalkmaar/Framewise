/**
 * Resolve the OpenGraph image URL for a public page (step 26).
 *
 * The fallback chain is intentional:
 *
 *   page seo_meta.og_image_url
 *     → site (tenant.og_image_url)
 *       → first image found in the page's blocks
 *         → Picsum default keyed on the tenant slug
 *
 * The Picsum default is deterministic per tenant so social cards
 * don't reshuffle between deploys. It's a placeholder until tenants
 * upload their own — no real image hits production unless the
 * tenant or a page sets one explicitly.
 */
export interface OgImageInput {
  /** From page.seo_meta.og_image_url. Highest priority. */
  pageOgImage?: string | null;
  /** From tenant.og_image_url. Site-wide default. */
  siteOgImage?: string | null;
  /** First image URL we could find in the page's blocks (hero/image/gallery). */
  firstImageInBlocks?: string | null;
  /** Used to derive the Picsum seed when nothing else is set. */
  tenantSlug: string;
}

export const OG_IMAGE_DIMENSIONS = { width: 1200, height: 630 } as const;

/**
 * Returns a non-empty URL string for the chosen OpenGraph image.
 * Whitespace-only strings are treated as missing — only properly
 * filled URLs win in the chain.
 */
export function resolveOgImage(input: OgImageInput): string {
  const candidates = [input.pageOgImage, input.siteOgImage, input.firstImageInBlocks];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return defaultOgImage(input.tenantSlug);
}

/**
 * Picsum fallback URL. Always returns a 1200x630 image with the
 * tenant slug as the seed. Slug is forced to lowercase + hyphenated
 * — Picsum accepts arbitrary tokens but this keeps URLs stable for
 * tenants that change capitalisation later.
 */
export function defaultOgImage(tenantSlug: string): string {
  const seed = (tenantSlug || 'framewise').toLowerCase().replace(/\s+/g, '-');
  const { width, height } = OG_IMAGE_DIMENSIONS;
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}
