'use client';

import { useState, useTransition } from 'react';

import {
  deprovisionAgent,
  updateAgentSettings,
} from '@/app/(i18n)/[locale]/(auth-required)/account/site/agent/actions';
import type { AgentChannel, AgentSettings } from '@/types/database';

export interface AgentSettingsFormCopy {
  name: string;
  channel: string;
  channelText: string;
  channelVoice: string;
  channelBoth: string;
  channelLockedToText: string;
  language: string;
  greeting: string;
  greetingPlaceholder: string;
  personality: string;
  personalityProfessional: string;
  personalityCasual: string;
  personalityFormal: string;
  actions: string;
  actionTakeBookings: string;
  actionSharePricing: string;
  actionProvideContact: string;
  forbiddenTopics: string;
  forbiddenTopicsHint: string;
  forbiddenTopicsPlaceholder: string;
  forbiddenAdd: string;
  forbiddenRemove: string;
  save: string;
  saving: string;
  saved: string;
  saveError: string;
  deactivate: string;
  deactivateConfirm: string;
}

export interface AgentSettingsFormProps {
  agentName: string;
  agentChannel: AgentChannel;
  agentLanguage: string;
  initialSettings: AgentSettings;
  copy: AgentSettingsFormCopy;
}

/**
 * Editable persona + behaviour form (step 56). One save button —
 * batches every field into a single `updateAgentSettings` call. The
 * channel + language + name are presented read-only here because
 * they're set at provision time + need a re-provision to change
 * (or, for the language, the upcoming step-57 voice flow).
 */
export function AgentSettingsForm({
  agentName,
  agentChannel,
  agentLanguage,
  initialSettings,
  copy,
}: AgentSettingsFormProps): React.ReactElement {
  const [greeting, setGreeting] = useState(initialSettings.greeting_message);
  const [personality, setPersonality] = useState(initialSettings.personality);
  const [maxLen, setMaxLen] = useState(initialSettings.max_response_length);
  const [forbidden, setForbidden] = useState<string[]>([...initialSettings.forbidden_topics]);
  const [forbiddenDraft, setForbiddenDraft] = useState('');
  const [takeBookings, setTakeBookings] = useState(initialSettings.can_take_bookings);
  const [sharePricing, setSharePricing] = useState(initialSettings.can_share_pricing);
  const [provideContact, setProvideContact] = useState(initialSettings.can_provide_contact);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  function addForbidden() {
    const trimmed = forbiddenDraft.trim();
    if (!trimmed || forbidden.includes(trimmed)) return;
    setForbidden([...forbidden, trimmed]);
    setForbiddenDraft('');
  }

  function removeForbidden(topic: string) {
    setForbidden(forbidden.filter((t) => t !== topic));
  }

  function handleSave() {
    setStatus('idle');
    startTransition(async () => {
      const r = await updateAgentSettings({
        greeting_message: greeting,
        personality,
        max_response_length: maxLen,
        forbidden_topics: forbidden,
        can_take_bookings: takeBookings,
        can_share_pricing: sharePricing,
        can_provide_contact: provideContact,
      });
      setStatus(r.success ? 'saved' : 'error');
      if (r.success) setTimeout(() => setStatus('idle'), 1500);
    });
  }

  function handleDeactivate() {
    if (!window.confirm(copy.deactivateConfirm)) return;
    startTransition(async () => {
      const r = await deprovisionAgent();
      if (r.success) window.location.reload();
      else setStatus('error');
    });
  }

  const channelLabel =
    agentChannel === 'voice'
      ? copy.channelVoice
      : agentChannel === 'both'
        ? copy.channelBoth
        : copy.channelText;

  return (
    <form
      data-testid="agent-settings-form"
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <section className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-muted-foreground text-xs">{copy.name}</label>
          <p data-testid="agent-name" className="mt-1 font-mono text-sm">
            {agentName}
          </p>
        </div>
        <div>
          <label className="text-muted-foreground text-xs">{copy.channel}</label>
          <p data-testid="agent-channel" className="mt-1 font-mono text-sm">
            {channelLabel}
          </p>
          {agentChannel === 'text' ? (
            <p className="text-muted-foreground mt-1 text-[10px]">{copy.channelLockedToText}</p>
          ) : null}
        </div>
        <div>
          <label className="text-muted-foreground text-xs">{copy.language}</label>
          <p data-testid="agent-language" className="mt-1 font-mono text-sm uppercase">
            {agentLanguage}
          </p>
        </div>
      </section>

      <section>
        <label className="text-muted-foreground text-xs">{copy.greeting}</label>
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder={copy.greetingPlaceholder}
          rows={3}
          data-testid="greeting-message"
          className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </section>

      <section>
        <label className="text-muted-foreground text-xs">{copy.personality}</label>
        <select
          value={personality}
          onChange={(e) => setPersonality(e.target.value)}
          data-testid="personality-select"
          className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="professional_warm">{copy.personalityProfessional}</option>
          <option value="casual_friendly">{copy.personalityCasual}</option>
          <option value="formal_business">{copy.personalityFormal}</option>
        </select>
      </section>

      <section>
        <p className="text-muted-foreground text-xs">{copy.actions}</p>
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={takeBookings}
              onChange={(e) => setTakeBookings(e.target.checked)}
              data-testid="can-take-bookings-checkbox"
            />
            <span>{copy.actionTakeBookings}</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sharePricing}
              onChange={(e) => setSharePricing(e.target.checked)}
              data-testid="can-share-pricing-checkbox"
            />
            <span>{copy.actionSharePricing}</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={provideContact}
              onChange={(e) => setProvideContact(e.target.checked)}
              data-testid="can-provide-contact-checkbox"
            />
            <span>{copy.actionProvideContact}</span>
          </label>
        </div>
      </section>

      <section>
        <label className="text-muted-foreground text-xs">{copy.forbiddenTopics}</label>
        <p className="text-muted-foreground mt-1 text-[10px]">{copy.forbiddenTopicsHint}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {forbidden.map((t) => (
            <span
              key={t}
              className="bg-muted text-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs"
            >
              {t}
              <button
                type="button"
                onClick={() => removeForbidden(t)}
                data-testid={`forbidden-remove-${t}`}
                aria-label={copy.forbiddenRemove}
                className="text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={forbiddenDraft}
            onChange={(e) => setForbiddenDraft(e.target.value)}
            placeholder={copy.forbiddenTopicsPlaceholder}
            data-testid="forbidden-input"
            className="bg-background border-input flex-1 rounded-md border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addForbidden}
            data-testid="forbidden-add"
            className="ring-border bg-background hover:bg-muted rounded-md px-3 py-2 text-sm ring-1"
          >
            {copy.forbiddenAdd}
          </button>
        </div>
      </section>

      <section>
        <label className="text-muted-foreground text-xs">
          Max response length ({maxLen} chars)
        </label>
        <input
          type="range"
          min={50}
          max={1000}
          step={10}
          value={maxLen}
          onChange={(e) => setMaxLen(Number(e.target.value))}
          data-testid="max-length-slider"
          className="mt-1 w-full"
        />
      </section>

      <div className="flex items-center justify-between gap-2 pt-4">
        <button
          type="submit"
          disabled={pending}
          data-testid="save-button"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
        >
          {pending ? copy.saving : status === 'saved' ? copy.saved : copy.save}
        </button>
        {status === 'error' ? (
          <p data-testid="save-error" className="text-destructive text-sm">
            {copy.saveError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleDeactivate}
          disabled={pending}
          data-testid="deactivate-button"
          className="ring-destructive/40 text-destructive hover:bg-destructive/10 rounded-md px-4 py-2 text-sm ring-1 disabled:opacity-50"
        >
          {copy.deactivate}
        </button>
      </div>
    </form>
  );
}
