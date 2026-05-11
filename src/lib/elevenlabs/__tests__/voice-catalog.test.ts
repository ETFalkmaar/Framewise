import { describe, expect, it } from 'vitest';

import {
  STUB_VOICES,
  getVoiceById,
  getVoicesByLanguage,
} from '@/lib/elevenlabs/voice-catalog';

describe('voice catalog (step 57)', () => {
  it('exports voices in all four supported agent languages', () => {
    const langs = new Set(STUB_VOICES.map((v) => v.language));
    expect(langs.has('nl')).toBe(true);
    expect(langs.has('fr')).toBe(true);
    expect(langs.has('en')).toBe(true);
    expect(langs.has('es')).toBe(true);
  });

  it("getVoicesByLanguage('nl') returns the three NL voices", () => {
    const nl = getVoicesByLanguage('nl');
    expect(nl).toHaveLength(3);
    expect(nl.every((v) => v.language === 'nl')).toBe(true);
  });

  it("getVoicesByLanguage('es') returns the Caribbean voice for Demo Villa", () => {
    const es = getVoicesByLanguage('es');
    expect(es).toHaveLength(1);
    expect(es[0].name).toBe('Sofia');
    expect(es[0].accent).toContain('Caribbean');
  });

  it('getVoicesByLanguage returns an empty array for unknown languages', () => {
    expect(getVoicesByLanguage('zz')).toEqual([]);
  });

  it('getVoiceById finds an existing voice', () => {
    const anna = getVoiceById('stub-voice-nl-anna');
    expect(anna).not.toBeNull();
    expect(anna?.name).toBe('Anna');
  });

  it('getVoiceById returns null for unknown ids', () => {
    expect(getVoiceById('stub-voice-zz-xyz')).toBeNull();
  });

  it('flags exactly one NL voice as premium (Emma)', () => {
    const premium = STUB_VOICES.filter((v) => v.is_premium);
    expect(premium).toHaveLength(1);
    expect(premium[0].name).toBe('Emma');
    expect(premium[0].language).toBe('nl');
  });

  it('every voice has a non-empty sample_url', () => {
    for (const v of STUB_VOICES) {
      expect(v.sample_url.length).toBeGreaterThan(0);
    }
  });
});
