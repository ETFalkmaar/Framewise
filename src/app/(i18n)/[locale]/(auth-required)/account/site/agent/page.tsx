import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AgentProvisionCard } from '@/components/agent/agent-provision-card';
import { AgentSettingsForm } from '@/components/agent/agent-settings-form';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { agentSettingsRepo, aiAgentsRepo } from '@/lib/data';
import { canViewAgent } from '@/lib/permissions/ai-agent';
import type { AgentSettings, AgentStatus } from '@/types/database';

/**
 * AI agent management page (step 56, fase 15 part 1/9). Surfaces
 * one of four render modes based on the current agent's status:
 *
 *  1. `not_provisioned` (or no row yet) → provision card.
 *  2. `provisioning` → loading state with manual refresh hint.
 *  3. `active` → editable settings form.
 *  4. `error` → retry CTA + last error message.
 *  5. `disabled` → "Re-activate" CTA (same flow as provision).
 *
 * Gated on `canViewAgent` so editors can read; the form's submit
 * actions enforce `canConfigureAgent` server-side.
 */
export default async function AgentManagementPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const tenant = await getActiveTenantForUser();
  if (!tenant) notFound();
  if (!tenant.ai_agent_enabled) notFound();

  const allowed = await canViewAgent(user.id, tenant);
  if (!allowed) notFound();

  const agent = await aiAgentsRepo.findByTenantId(tenant.id);
  const status: AgentStatus = agent?.status ?? 'not_provisioned';

  const t = await getTranslations('agent');

  return (
    <main
      data-testid="agent-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <Link
          href="/account"
          data-testid="back-to-account"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {t('backToAccount')}
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-display-md font-bold tracking-tight">{t('title')}</h1>
          <span
            data-testid={`agent-status-${status}`}
            className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase ${
              status === 'active'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : status === 'error'
                  ? 'bg-destructive/15 text-destructive'
                  : status === 'provisioning'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-muted text-muted-foreground'
            }`}
          >
            {t(`status.${camelStatus(status)}`)}
          </span>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">{t('subtitle')}</p>
      </header>

      {status === 'not_provisioned' || status === 'disabled' ? (
        <AgentProvisionCard
          copy={{
            title: t('provision.title'),
            subtitle: t('provision.subtitle'),
            features: [
              t('provision.features.0'),
              t('provision.features.1'),
              t('provision.features.2'),
              t('provision.features.3'),
            ],
            button: t('provision.button'),
            provisioning: t('provision.provisioning'),
            errorGeneric: t('errors.provisioning_failed'),
          }}
        />
      ) : null}

      {status === 'provisioning' ? (
        <section
          data-testid="agent-provisioning"
          className="border-border bg-muted/20 rounded-lg border p-8 text-center"
        >
          <h2 className="text-xl font-semibold">{t('provisioning.title')}</h2>
          <p className="text-muted-foreground mt-2 text-sm">{t('provisioning.subtitle')}</p>
        </section>
      ) : null}

      {status === 'error' && agent ? (
        <section
          data-testid="agent-error"
          className="ring-destructive/40 bg-destructive/10 rounded-lg p-6 ring-1"
        >
          <h2 className="text-destructive text-lg font-semibold">{t('errorState.title')}</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {agent.last_error ?? t('errorState.unknown')}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">{t('errorState.retryHint')}</p>
        </section>
      ) : null}

      {status === 'active' && agent ? <ActiveAgentView agent={agent} locale={locale} /> : null}
    </main>
  );
}

function camelStatus(s: AgentStatus): string {
  // Maps `not_provisioned` → `notProvisioned` for the translation key.
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

async function ActiveAgentView({
  agent,
  locale,
}: {
  agent: { id: string; name: string; channel: 'text' | 'voice' | 'both'; language: string };
  locale: Locale;
}) {
  const settings = await agentSettingsRepo.findByAgentId(agent.id);
  // Defensive default — the provision action always seeds defaults
  // but the type system can't know that statically.
  const safeSettings: AgentSettings = settings ?? {
    agent_id: agent.id,
    greeting_message: '',
    personality: 'professional_warm',
    max_response_length: 300,
    forbidden_topics: [],
    can_take_bookings: false,
    can_share_pricing: true,
    can_provide_contact: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const t = await getTranslations('agent');
  void locale;
  const isVoiceCapable = agent.channel === 'voice' || agent.channel === 'both';
  return (
    <section data-testid="agent-active" className="space-y-6">
      <nav className="flex flex-wrap gap-2">
        <Link
          href="/account/site/agent/voice"
          data-testid="link-voice-config"
          aria-disabled={!isVoiceCapable}
          className={`ring-border rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition ${
            isVoiceCapable
              ? 'bg-background hover:bg-muted'
              : 'bg-muted/30 text-muted-foreground cursor-not-allowed'
          }`}
        >
          {isVoiceCapable
            ? `🎙 ${t('voice.tabLabel')}`
            : `🎙 ${t('voice.tabLabel')} (${t('voice.enterpriseOnly')})`}
        </Link>
      </nav>
      <AgentSettingsForm
        agentName={agent.name}
        agentChannel={agent.channel}
        agentLanguage={agent.language}
        initialSettings={safeSettings}
        copy={{
          name: t('settings.name'),
          channel: t('settings.channel'),
          channelText: t('settings.channelText'),
          channelVoice: t('settings.channelVoice'),
          channelBoth: t('settings.channelBoth'),
          channelLockedToText: t('settings.channelLockedToText'),
          language: t('settings.language'),
          greeting: t('settings.greeting'),
          greetingPlaceholder: t('settings.greetingPlaceholder'),
          personality: t('settings.personality'),
          personalityProfessional: t('settings.personalityProfessional'),
          personalityCasual: t('settings.personalityCasual'),
          personalityFormal: t('settings.personalityFormal'),
          actions: t('settings.actions'),
          actionTakeBookings: t('settings.actionTakeBookings'),
          actionSharePricing: t('settings.actionSharePricing'),
          actionProvideContact: t('settings.actionProvideContact'),
          forbiddenTopics: t('settings.forbiddenTopics'),
          forbiddenTopicsHint: t('settings.forbiddenTopicsHint'),
          forbiddenTopicsPlaceholder: t('settings.forbiddenTopicsPlaceholder'),
          forbiddenAdd: t('settings.forbiddenAdd'),
          forbiddenRemove: t('settings.forbiddenRemove'),
          save: t('settings.save'),
          saving: t('settings.saving'),
          saved: t('settings.saved'),
          saveError: t('settings.saveError'),
          deactivate: t('actions.deactivate'),
          deactivateConfirm: t('actions.deactivateConfirm'),
        }}
      />
    </section>
  );
}
