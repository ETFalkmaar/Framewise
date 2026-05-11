'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import {
  generateVoiceSample,
  selectVoice,
  updateVoiceSettings,
} from '@/app/(i18n)/[locale]/(auth-required)/account/site/agent/voice/actions';
import type { AgentLanguage, AgentVoiceConfig, VoiceCatalogEntry } from '@/types/database';

export interface VoicePickerCopy {
  tabsLabel: string;
  card: {
    select: string;
    selected: string;
    premium: string;
    playSample: string;
    stopSample: string;
  };
  settings: {
    title: string;
    stability: string;
    stabilityHint: string;
    similarityBoost: string;
    similarityHint: string;
    style: string;
    styleHint: string;
    speakerBoost: string;
    speakerBoostHint: string;
    testWithGreeting: string;
    save: string;
    saving: string;
    saved: string;
    saveError: string;
  };
}

export interface VoicePickerProps {
  voices: VoiceCatalogEntry[];
  currentConfig: AgentVoiceConfig | null;
  defaultLanguage: AgentLanguage;
  copy: VoicePickerCopy;
}

/**
 * Voice picker (step 57). Three regions:
 *
 *  1. Language tabs (NL/FR/EN/ES). Default to the agent's primary
 *     language so the most-relevant voices show first.
 *  2. Grid of voice cards. Click "Selecteer" to persist the choice
 *     server-side; the audio play button toggles the catalog sample.
 *  3. Slider settings — only renders after a voice is selected.
 *     Save button calls `updateVoiceSettings` server action; the
 *     "Test met begroeting" button generates a fresh sample using
 *     the agent's configured greeting message.
 */
export function VoicePicker({
  voices,
  currentConfig,
  defaultLanguage,
  copy,
}: VoicePickerProps): React.ReactElement {
  const [activeLang, setActiveLang] = useState<AgentLanguage>(defaultLanguage);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(
    currentConfig?.voice_id ?? null
  );
  const [stability, setStability] = useState(currentConfig?.stability ?? 0.5);
  const [similarity, setSimilarity] = useState(currentConfig?.similarity_boost ?? 0.75);
  const [style, setStyle] = useState(currentConfig?.style ?? 0);
  const [speakerBoost, setSpeakerBoost] = useState(currentConfig?.speaker_boost ?? true);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const filtered = voices.filter((v) => v.language === activeLang);
  const selectedVoice = voices.find((v) => v.voice_id === selectedVoiceId) ?? null;

  // Keep the audio element synced with the active src + auto-play.
  useEffect(() => {
    if (!audioSrc || !audioRef.current) return;
    audioRef.current.src = audioSrc;
    audioRef.current.play().catch(() => {
      /* autoplay can be blocked; the user-controlled play button handles it */
    });
  }, [audioSrc]);

  function handlePlay(voice: VoiceCatalogEntry) {
    if (playingVoiceId === voice.voice_id) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }
    setAudioSrc(voice.sample_url);
    setPlayingVoiceId(voice.voice_id);
  }

  function handleSelect(voice: VoiceCatalogEntry) {
    setSelectedVoiceId(voice.voice_id);
    startTransition(async () => {
      await selectVoice({ voice_id: voice.voice_id });
    });
  }

  function handleTestWithGreeting() {
    if (!selectedVoiceId) return;
    startTransition(async () => {
      const r = await generateVoiceSample({ voice_id: selectedVoiceId });
      if (r.success && r.audioUrl) {
        setAudioSrc(r.audioUrl);
        setPlayingVoiceId(selectedVoiceId);
      }
    });
  }

  function handleSaveSettings() {
    if (!selectedVoiceId) return;
    setSaveStatus('idle');
    startTransition(async () => {
      const r = await updateVoiceSettings({
        stability,
        similarity_boost: similarity,
        style,
        speaker_boost: speakerBoost,
      });
      setSaveStatus(r.success ? 'saved' : 'error');
      if (r.success) setTimeout(() => setSaveStatus('idle'), 1500);
    });
  }

  return (
    <section data-testid="voice-picker" className="space-y-6">
      <div className="border-border flex flex-wrap gap-2 border-b pb-2">
        <span className="text-muted-foreground self-center text-xs">{copy.tabsLabel}:</span>
        {(['nl', 'fr', 'en', 'es'] as AgentLanguage[]).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setActiveLang(lang)}
            data-testid={`voice-lang-${lang}`}
            className={`rounded-md px-3 py-1 font-mono text-xs uppercase ${
              activeLang === lang
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      <div data-testid="voice-grid" className="grid gap-3 md:grid-cols-2">
        {filtered.map((voice) => (
          <VoiceCard
            key={voice.voice_id}
            voice={voice}
            isSelected={selectedVoiceId === voice.voice_id}
            isPlaying={playingVoiceId === voice.voice_id}
            onPlay={() => handlePlay(voice)}
            onSelect={() => handleSelect(voice)}
            disabled={pending}
            copy={copy.card}
          />
        ))}
      </div>

      {selectedVoice ? (
        <section data-testid="voice-settings" className="border-border space-y-4 border-t pt-4">
          <h3 className="text-lg font-semibold">{copy.settings.title}</h3>
          <VoiceSlider
            label={copy.settings.stability}
            hint={copy.settings.stabilityHint}
            value={stability}
            onChange={setStability}
            testid="slider-stability"
          />
          <VoiceSlider
            label={copy.settings.similarityBoost}
            hint={copy.settings.similarityHint}
            value={similarity}
            onChange={setSimilarity}
            testid="slider-similarity"
          />
          <VoiceSlider
            label={copy.settings.style}
            hint={copy.settings.styleHint}
            value={style}
            onChange={setStyle}
            testid="slider-style"
          />
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={speakerBoost}
              onChange={(e) => setSpeakerBoost(e.target.checked)}
              data-testid="speaker-boost-checkbox"
              className="mt-1"
            />
            <span>
              <span className="font-medium">{copy.settings.speakerBoost}</span>
              <span className="text-muted-foreground mt-1 block text-xs">
                {copy.settings.speakerBoostHint}
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestWithGreeting}
              disabled={pending}
              data-testid="test-voice-button"
              className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 text-sm ring-1 disabled:opacity-50"
            >
              {copy.settings.testWithGreeting}
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={pending}
              data-testid="save-voice-button"
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
            >
              {pending
                ? copy.settings.saving
                : saveStatus === 'saved'
                  ? copy.settings.saved
                  : copy.settings.save}
            </button>
            {saveStatus === 'error' ? (
              <span data-testid="save-error" className="text-destructive text-sm">
                {copy.settings.saveError}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Audio sink — hidden but functional. */}
      <audio
        ref={audioRef}
        data-testid="voice-audio"
        controls
        onEnded={() => setPlayingVoiceId(null)}
        className="hidden"
      />
    </section>
  );
}

function VoiceCard({
  voice,
  isSelected,
  isPlaying,
  onPlay,
  onSelect,
  disabled,
  copy,
}: {
  voice: VoiceCatalogEntry;
  isSelected: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onSelect: () => void;
  disabled: boolean;
  copy: VoicePickerCopy['card'];
}): React.ReactElement {
  return (
    <article
      data-testid={`voice-card-${voice.voice_id}`}
      className={`border-border bg-muted/20 rounded-lg border p-4 ${
        isSelected ? 'ring-primary ring-2' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-base font-semibold">
            {voice.name}
            {voice.is_premium ? (
              <span
                data-testid={`voice-premium-${voice.voice_id}`}
                className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] text-amber-700 uppercase dark:text-amber-300"
              >
                {copy.premium}
              </span>
            ) : null}
          </h4>
          {voice.accent ? (
            <p className="text-muted-foreground font-mono text-[10px] uppercase">{voice.accent}</p>
          ) : null}
          <p className="text-muted-foreground mt-2 text-sm">{voice.description}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onPlay}
          data-testid={`voice-play-${voice.voice_id}`}
          className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1"
        >
          {isPlaying ? `⏸ ${copy.stopSample}` : `▶ ${copy.playSample}`}
        </button>
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled || isSelected}
          data-testid={`voice-select-${voice.voice_id}`}
          className={`rounded-md px-3 py-1.5 font-mono text-xs disabled:opacity-50 ${
            isSelected
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-primary text-primary-foreground'
          }`}
        >
          {isSelected ? copy.selected : copy.select}
        </button>
      </div>
    </article>
  );
}

function VoiceSlider({
  label,
  hint,
  value,
  onChange,
  testid,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  testid: string;
}): React.ReactElement {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-muted-foreground font-mono text-xs">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-testid={testid}
        className="mt-1 w-full"
      />
      <p className="text-muted-foreground mt-1 text-[10px]">{hint}</p>
    </div>
  );
}
