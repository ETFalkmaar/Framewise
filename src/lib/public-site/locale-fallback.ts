import type { Locale, LocaleStringMap } from '@/lib/blocks/types';

/**
 * Resolve a localised string from a `{ locale → text }` map.
 *
 * Fallback chain:
 *   1. `translations[locale]` — exact match.
 *   2. `translations[defaultLocale]` — tenant or page default.
 *   3. First non-empty value in any locale (deterministic via key sort).
 *   4. `''` (empty string) — never `undefined`.
 *
 * Empty strings inside the map are treated as missing so a partially
 * translated entry can still fall through to a real value. Used by
 * every block component to avoid scattering null-checks.
 */
export function getTranslatedString(
  translations: LocaleStringMap | undefined,
  locale: Locale,
  defaultLocale: Locale = 'nl'
): string {
  if (!translations) return '';

  const direct = translations[locale];
  if (typeof direct === 'string' && direct.length > 0) return direct;

  if (defaultLocale !== locale) {
    const fallback = translations[defaultLocale];
    if (typeof fallback === 'string' && fallback.length > 0) return fallback;
  }

  // Sort keys to keep the fallback choice deterministic across runs;
  // useful in tests and for CDN cache stability.
  const keys = Object.keys(translations).sort() as Locale[];
  for (const key of keys) {
    const v = translations[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }

  return '';
}
