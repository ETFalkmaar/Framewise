import type { VoiceCatalogEntry } from '@/types/database';

/**
 * Stub voice catalog (step 57, fase 15 part 2/9). Six voices spanning
 * the four supported agent languages — enough to exercise the picker
 * UI without hitting the ElevenLabs API. Premium flag flips one NL
 * voice into the Enterprise+-only state so we can demo the lock.
 *
 * Sample audio URLs point at a shared 1-second silent mp3 we ship
 * in `public/stub-audio/`. The real provider returns one mp3 per
 * voice; the stub deliberately doesn't try to fake distinct audio.
 */
const SAMPLE_URL = '/stub-audio/silent-1s.mp3';

export const STUB_VOICES: VoiceCatalogEntry[] = [
  // NL — 3 voices including one premium.
  {
    voice_id: 'stub-voice-nl-anna',
    name: 'Anna',
    language: 'nl',
    accent: 'Standaard Nederlands',
    gender: 'female',
    description: 'Warm en professioneel',
    sample_url: SAMPLE_URL,
    is_premium: false,
  },
  {
    voice_id: 'stub-voice-nl-pieter',
    name: 'Pieter',
    language: 'nl',
    accent: 'Standaard Nederlands',
    gender: 'male',
    description: 'Zakelijk en vertrouwd',
    sample_url: SAMPLE_URL,
    is_premium: false,
  },
  {
    voice_id: 'stub-voice-nl-emma',
    name: 'Emma',
    language: 'nl',
    accent: 'Vlaams',
    gender: 'female',
    description: 'Casual en vriendelijk',
    sample_url: SAMPLE_URL,
    is_premium: true,
  },
  // FR — single representative voice.
  {
    voice_id: 'stub-voice-fr-claire',
    name: 'Claire',
    language: 'fr',
    accent: 'Français standard',
    gender: 'female',
    description: 'Professionnel et chaleureux',
    sample_url: SAMPLE_URL,
    is_premium: false,
  },
  // EN — British, professional.
  {
    voice_id: 'stub-voice-en-james',
    name: 'James',
    language: 'en',
    accent: 'British English',
    gender: 'male',
    description: 'Professional and clear',
    sample_url: SAMPLE_URL,
    is_premium: false,
  },
  // ES — Caribbean tone, demoable for Demo Villa Curaçao.
  {
    voice_id: 'stub-voice-es-sofia',
    name: 'Sofia',
    language: 'es',
    accent: 'Spanish Caribbean',
    gender: 'female',
    description: 'Warm Caribbean tone',
    sample_url: SAMPLE_URL,
    is_premium: false,
  },
];

/** Filter the catalog by language. Returns a fresh array. */
export function getVoicesByLanguage(language: string): VoiceCatalogEntry[] {
  return STUB_VOICES.filter((v) => v.language === language);
}

/** Lookup a single voice by id. Returns null for unknown ids. */
export function getVoiceById(voiceId: string): VoiceCatalogEntry | null {
  return STUB_VOICES.find((v) => v.voice_id === voiceId) ?? null;
}
