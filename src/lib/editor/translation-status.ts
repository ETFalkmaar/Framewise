import type { Block, LocaleCode } from '@/types/database';

/**
 * Translation completeness helpers for the customer-facing block
 * editor (step 43, fase 12 part 5/8).
 *
 * "Empty" is permissive: a missing key, `null`, `undefined`, an
 * all-whitespace string, or TipTap's literal-empty `<p></p>` /
 * `<p><br></p>` all count as missing. This matches what the
 * editor's amber-dot badge surfaces — anything the customer
 * would see as "I haven't written this yet".
 */
export const SUPPORTED_LOCALES: readonly LocaleCode[] = ['nl', 'fr', 'en'] as const;

export interface TranslationStatus {
  locale: LocaleCode;
  isMissing: boolean;
}

const EMPTY_HTML_RE = /^<p>(\s|&nbsp;)*(<br\s*\/?>\s*)?<\/p>$/i;

export function isTranslationMissing(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (EMPTY_HTML_RE.test(trimmed)) return true;
  return false;
}

export function getTranslationStatus(
  translations: Record<string, string> | null | undefined,
  locales: readonly LocaleCode[] = SUPPORTED_LOCALES
): TranslationStatus[] {
  return locales.map((locale) => ({
    locale,
    isMissing: isTranslationMissing(translations?.[locale]),
  }));
}

/**
 * Map of which `block.data` keys are multi-locale strings, by
 * block type. Keeps the missing-translation counter honest —
 * `hero` has 3 translatable fields, `text` has 1, `image` has
 * 2, the rest have 0 in step 43's wiring.
 */
const TRANSLATABLE_KEYS_BY_TYPE: Record<Block['block_type'], readonly string[]> = {
  text: ['content_translations'],
  hero: ['headline_translations', 'subheadline_translations', 'cta_text_translations'],
  image: ['alt_translations', 'caption_translations'],
  gallery: [],
  cta: [],
  faq: [],
  pricing: [],
  contact: [],
};

export function listTranslatableKeys(blockType: Block['block_type']): readonly string[] {
  return TRANSLATABLE_KEYS_BY_TYPE[blockType] ?? [];
}

/**
 * Count missing per-locale entries across every translatable
 * field on a block. `hero` with NL filled but FR + EN empty on
 * all 3 fields returns 6 (3 fields × 2 missing locales).
 */
export function countMissingTranslations(
  block: Block,
  locales: readonly LocaleCode[] = SUPPORTED_LOCALES
): number {
  const keys = listTranslatableKeys(block.block_type);
  if (keys.length === 0) return 0;
  let missing = 0;
  for (const key of keys) {
    const map = (block.data as Record<string, unknown>)[key];
    if (map === undefined || map === null) {
      missing += locales.length;
      continue;
    }
    if (typeof map !== 'object') {
      missing += locales.length;
      continue;
    }
    const record = map as Record<string, unknown>;
    for (const locale of locales) {
      const value = record[locale];
      if (typeof value !== 'string' || isTranslationMissing(value)) missing += 1;
    }
  }
  return missing;
}
