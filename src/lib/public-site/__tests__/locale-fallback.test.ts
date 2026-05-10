import { describe, expect, it } from 'vitest';
import { getTranslatedString } from '@/lib/public-site/locale-fallback';

describe('getTranslatedString', () => {
  it('returns the exact-locale match when present', () => {
    expect(getTranslatedString({ nl: 'Hallo', en: 'Hello' }, 'en')).toBe('Hello');
  });

  it('falls back to the default locale when the requested one is missing', () => {
    expect(getTranslatedString({ nl: 'Hallo' }, 'en', 'nl')).toBe('Hallo');
  });

  it('falls back to the first available locale (alphabetical) when both target + default are missing', () => {
    // 'fr' comes before 'nl' alphabetically — deterministic fallback.
    expect(getTranslatedString({ nl: 'Hallo', fr: 'Bonjour' }, 'en', 'en')).toBe('Bonjour');
  });

  it('returns "" for undefined translations', () => {
    expect(getTranslatedString(undefined, 'en')).toBe('');
  });

  it('returns "" for an empty translations object', () => {
    expect(getTranslatedString({}, 'en')).toBe('');
  });

  it('treats empty strings as missing and continues the fallback chain', () => {
    expect(getTranslatedString({ nl: '', en: 'Hello' }, 'nl', 'en')).toBe('Hello');
  });

  it('returns "" when every entry is empty', () => {
    expect(getTranslatedString({ nl: '', en: '' }, 'nl')).toBe('');
  });

  it('returns the default-locale value even when a malformed locale-key is present', () => {
    // A future schema migration might leave behind unexpected keys —
    // the fallback chain should still find the legitimate one.
    const translations = { nl: 'Hallo' } as unknown as Parameters<typeof getTranslatedString>[0];
    expect(getTranslatedString(translations, 'en', 'nl')).toBe('Hallo');
  });
});
