/**
 * Incremental Static Regeneration windows used across the public
 * renderer (step 29, closes fase 9). Values are in seconds.
 *
 * Trade-off: shorter windows surface freshly published pages faster
 * but pay the database round-trip more often. 60 s for public pages
 * matches the editor's "publish — wait a minute — verify" flow
 * without giving up the speed and cost benefits of static caching.
 *
 * Booking pages (later phases) opt out of ISR because they need
 * live availability; these constants only document the default for
 * read-mostly content.
 *
 * Each window is exported as its own `const` so route segment
 * configuration (`export const revalidate = …`) stays statically
 * analyzable — Next.js requires the right-hand side to resolve to
 * a number literal at parse time, which a member-access against an
 * `as const` object does not always satisfy.
 */

/** Public tenant pages (homepage, inner pages). */
export const REVALIDATE_PUBLIC_PAGE = 60;

/** `/sitemap.xml` — already configured in step 27, kept here for one source of truth. */
export const REVALIDATE_SITEMAP = 60;

/** `/robots.txt` — barely changes; cache it for an hour. */
export const REVALIDATE_ROBOTS = 3600;

/** Privacy / terms placeholder pages. */
export const REVALIDATE_STATIC_CONTENT = 3600;

/** All four windows in a single object — useful for tests and audits. */
export const ISR_REVALIDATE = {
  PUBLIC_PAGE: REVALIDATE_PUBLIC_PAGE,
  SITEMAP: REVALIDATE_SITEMAP,
  ROBOTS: REVALIDATE_ROBOTS,
  STATIC_CONTENT: REVALIDATE_STATIC_CONTENT,
} as const;

export type IsrRevalidate = (typeof ISR_REVALIDATE)[keyof typeof ISR_REVALIDATE];
