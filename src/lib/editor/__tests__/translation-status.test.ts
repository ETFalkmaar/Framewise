import { describe, expect, it } from 'vitest';

import type { Block } from '@/types/database';

import {
  countMissingTranslations,
  getTranslationStatus,
  isTranslationMissing,
  listTranslatableKeys,
  SUPPORTED_LOCALES,
} from '../translation-status';

const heroBlock = (overrides: Partial<Block['data']> = {}): Block => ({
  id: 'b1',
  page_id: 'p1',
  block_type: 'hero',
  order_index: 0,
  data: {
    headline_translations: { nl: 'NL hero', fr: 'FR hero', en: 'EN hero' },
    subheadline_translations: { nl: '', fr: '', en: '' },
    cta_text_translations: { nl: 'NL cta', fr: 'FR cta', en: 'EN cta' },
    ...overrides,
  },
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  version: 1,
});

const textBlock = (overrides: Partial<Block['data']> = {}): Block => ({
  id: 'b2',
  page_id: 'p1',
  block_type: 'text',
  order_index: 1,
  data: {
    content_translations: { nl: '<p>NL</p>', fr: '<p>FR</p>', en: '<p>EN</p>' },
    ...overrides,
  },
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  version: 1,
});

describe('isTranslationMissing', () => {
  it('treats null + undefined as missing', () => {
    expect(isTranslationMissing(null)).toBe(true);
    expect(isTranslationMissing(undefined)).toBe(true);
  });

  it('treats empty + whitespace strings as missing', () => {
    expect(isTranslationMissing('')).toBe(true);
    expect(isTranslationMissing('   ')).toBe(true);
    expect(isTranslationMissing('\n\t  ')).toBe(true);
  });

  it('treats TipTap literal-empty <p></p> as missing', () => {
    expect(isTranslationMissing('<p></p>')).toBe(true);
    expect(isTranslationMissing('<p><br></p>')).toBe(true);
    expect(isTranslationMissing('<p> </p>')).toBe(true);
  });

  it('treats non-empty content as present', () => {
    expect(isTranslationMissing('Hello')).toBe(false);
    expect(isTranslationMissing('<p>x</p>')).toBe(false);
    expect(isTranslationMissing('<p><strong>foo</strong></p>')).toBe(false);
  });
});

describe('getTranslationStatus', () => {
  it('returns three entries (one per locale)', () => {
    const status = getTranslationStatus({ nl: 'x', fr: 'y', en: 'z' });
    expect(status).toEqual([
      { locale: 'nl', isMissing: false },
      { locale: 'fr', isMissing: false },
      { locale: 'en', isMissing: false },
    ]);
  });

  it('flags the missing locales', () => {
    const status = getTranslationStatus({ nl: 'x', fr: '', en: '<p></p>' });
    expect(status.find((s) => s.locale === 'nl')?.isMissing).toBe(false);
    expect(status.find((s) => s.locale === 'fr')?.isMissing).toBe(true);
    expect(status.find((s) => s.locale === 'en')?.isMissing).toBe(true);
  });

  it('treats null/undefined translations object as all-missing', () => {
    const status = getTranslationStatus(null);
    expect(status.every((s) => s.isMissing)).toBe(true);
  });
});

describe('listTranslatableKeys', () => {
  it('returns content_translations for text', () => {
    expect(listTranslatableKeys('text')).toEqual(['content_translations']);
  });

  it('returns 3 keys for hero', () => {
    expect(listTranslatableKeys('hero')).toHaveLength(3);
  });

  it('returns 2 keys for image', () => {
    expect(listTranslatableKeys('image')).toEqual(['alt_translations', 'caption_translations']);
  });

  it("returns an empty list for block types step 43 doesn't wire", () => {
    expect(listTranslatableKeys('gallery')).toEqual([]);
    expect(listTranslatableKeys('faq')).toEqual([]);
  });
});

describe('countMissingTranslations', () => {
  it('returns 0 when every locale is filled on every translatable field', () => {
    expect(countMissingTranslations(textBlock())).toBe(0);
  });

  it('counts missing entries across multiple fields on a hero', () => {
    const block = heroBlock();
    // subheadline_translations is empty on all 3 locales → 3 missing
    expect(countMissingTranslations(block)).toBe(3);
  });

  it('treats a missing translations object as all locales missing for that field', () => {
    const block = heroBlock({ headline_translations: undefined });
    // headline_translations missing → +3 ; subheadline empty → +3 → total 6
    expect(countMissingTranslations(block)).toBe(6);
  });

  it('returns 0 for block types with no translatable keys (step 43 scope)', () => {
    const gallery: Block = { ...textBlock(), block_type: 'gallery', data: {} };
    expect(countMissingTranslations(gallery)).toBe(0);
  });

  it('respects the locales argument', () => {
    const block = textBlock({ content_translations: { nl: 'NL', fr: '' } });
    // Only count NL + FR — drop EN.
    expect(countMissingTranslations(block, ['nl', 'fr'])).toBe(1);
  });
});

describe('SUPPORTED_LOCALES', () => {
  it('is the canonical [nl, fr, en] tuple', () => {
    expect(Array.from(SUPPORTED_LOCALES)).toEqual(['nl', 'fr', 'en']);
  });
});
