import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { VoicePicker } from '@/components/agent/voice-picker';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { agentVoiceConfigsRepo, aiAgentsRepo } from '@/lib/data';
import { createElevenLabsClient } from '@/lib/elevenlabs/client';
import { canConfigureAgent } from '@/lib/permissions/ai-agent';
import type { AgentLanguage } from '@/types/database';

/**
 * Voice configuration page (step 57, fase 15 part 2/9).
 *
 * Three render modes:
 *
 *  1. Agent's channel is voice-capable (`voice` or `both`) →
 *     render the `<VoicePicker>` with the agent's primary language
 *     pre-selected and the existing config + slider values seeded.
 *  2. Agent's channel is `text` only (Pro tenants) → render the
 *     upgrade prompt that explains voice is Enterprise-only.
 *  3. Agent not provisioned yet → bounce back to the parent page
 *     (the customer needs to click "Activate" first).
 *
 * Gated on `canConfigureAgent` so editors can't mutate the voice.
 */
export default async function VoiceConfigPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const tenant = await getActiveTenantForUser();
  if (!tenant) notFound();
  if (!tenant.ai_agent_enabled) notFound();

  const allowed = await canConfigureAgent(user.id, tenant);
  if (!allowed) notFound();

  const agent = await aiAgentsRepo.findByTenantId(tenant.id);
  if (!agent) redirect('/account/site/agent');

  const t = await getTranslations('agent.voice');

  const isVoiceCapable = agent.channel === 'voice' || agent.channel === 'both';

  return (
    <main
      data-testid="voice-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <Link
          href="/account/site/agent"
          data-testid="back-to-agent"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {t('backToAgent')}
        </Link>
        <h1 className="text-display-md mt-2 font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('subtitle')}</p>
      </header>

      {!isVoiceCapable ? (
        <section
          data-testid="voice-not-available"
          className="border-border bg-muted/20 rounded-lg border p-8 text-center"
        >
          <h2 className="text-xl font-semibold">{t('notAvailable')}</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
            {t('notAvailableHint')}
          </p>
          <a
            href="https://framewise.app/pricing"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="voice-upgrade-cta"
            className="bg-primary text-primary-foreground mt-6 inline-block rounded-md px-6 py-3 text-sm font-medium"
          >
            {t('upgradeCTA')}
          </a>
        </section>
      ) : (
        <VoicePickerView agentId={agent.id} defaultLanguage={agent.language as AgentLanguage} />
      )}
    </main>
  );
}

async function VoicePickerView({
  agentId,
  defaultLanguage,
}: {
  agentId: string;
  defaultLanguage: AgentLanguage;
}) {
  const t = await getTranslations('agent.voice');
  const client = createElevenLabsClient();
  const [voices, currentConfig] = await Promise.all([
    client.listVoices(),
    agentVoiceConfigsRepo.findByAgentId(agentId),
  ]);

  return (
    <VoicePicker
      voices={voices}
      currentConfig={currentConfig}
      defaultLanguage={defaultLanguage}
      copy={{
        tabsLabel: t('tabsLabel'),
        card: {
          select: t('card.select'),
          selected: t('card.selected'),
          premium: t('card.premium'),
          playSample: t('card.playSample'),
          stopSample: t('card.stopSample'),
        },
        settings: {
          title: t('settings.title'),
          stability: t('settings.stability'),
          stabilityHint: t('settings.stabilityHint'),
          similarityBoost: t('settings.similarityBoost'),
          similarityHint: t('settings.similarityHint'),
          style: t('settings.style'),
          styleHint: t('settings.styleHint'),
          speakerBoost: t('settings.speakerBoost'),
          speakerBoostHint: t('settings.speakerBoostHint'),
          testWithGreeting: t('settings.testWithGreeting'),
          save: t('settings.save'),
          saving: t('settings.saving'),
          saved: t('settings.saved'),
          saveError: t('settings.saveError'),
        },
      }}
    />
  );
}
