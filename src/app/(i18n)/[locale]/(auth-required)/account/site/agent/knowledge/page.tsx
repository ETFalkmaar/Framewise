import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { KnowledgeBaseManager } from '@/components/agent/knowledge-base-manager';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { aiAgentsRepo, knowledgeBaseRepo } from '@/lib/data';
import { canConfigureAgent } from '@/lib/permissions/ai-agent';
import type { KnowledgeDocumentType, KnowledgeSyncStatus } from '@/types/database';

/**
 * Knowledge base management page (step 58, fase 15 part 3/9).
 *
 * Shows the owner what the AI assistant currently knows about the
 * business, split into two lists:
 *
 *  1. Auto-synced — built from published page content + FAQ blocks
 *     via `syncKnowledgeBase`. Read-only here; the user mutates the
 *     source pages and resyncs.
 *  2. Manual entries — owner-curated Q&A / pricing / contact notes.
 *     Created/edited/deleted from this page.
 *
 * Gated on `canConfigureAgent`. If no agent has been provisioned yet
 * we bounce back to the parent page so the owner can click
 * "Activate" first.
 */
export default async function KnowledgeBasePage({
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

  const allowed = await canConfigureAgent(user.id, tenant);
  if (!allowed) notFound();

  const agent = await aiAgentsRepo.findByTenantId(tenant.id);
  if (!agent) redirect('/account/site/agent');

  const [autoSynced, manualEntries] = await Promise.all([
    knowledgeBaseRepo.listAutoSynced(agent.id),
    knowledgeBaseRepo.listManualEntries(agent.id),
  ]);

  const t = await getTranslations('agent.knowledge');

  const statusKeys: KnowledgeSyncStatus[] = ['pending', 'syncing', 'synced', 'error'];
  const typeKeys: KnowledgeDocumentType[] = [
    'page_content',
    'faq',
    'manual_entry',
    'pricing',
    'contact_info',
  ];
  const manualTypeKeys: Array<'manual_entry' | 'pricing' | 'contact_info'> = [
    'manual_entry',
    'pricing',
    'contact_info',
  ];

  const statuses = Object.fromEntries(statusKeys.map((k) => [k, t(`statuses.${k}`)])) as Record<
    KnowledgeSyncStatus,
    string
  >;
  const types = Object.fromEntries(typeKeys.map((k) => [k, t(`types.${k}`)])) as Record<
    KnowledgeDocumentType,
    string
  >;
  const typeOptions = Object.fromEntries(manualTypeKeys.map((k) => [k, t(`types.${k}`)])) as Record<
    'manual_entry' | 'pricing' | 'contact_info',
    string
  >;

  return (
    <main
      data-testid="knowledge-page"
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

      <KnowledgeBaseManager
        autoSynced={autoSynced}
        manualEntries={manualEntries}
        locale={locale}
        copy={{
          sync: {
            button: t('sync.button'),
            syncing: t('sync.syncing'),
            lastSynced: t('sync.lastSynced'),
            never: t('sync.never'),
            successWithCountsTemplate: t.raw('sync.successWithCounts') as string,
            successNoChanges: t('sync.successNoChanges'),
            error: t('sync.error'),
          },
          sections: {
            autoSynced: t('sections.autoSynced'),
            autoSyncedHint: t('sections.autoSyncedHint'),
            manual: t('sections.manual'),
            manualHint: t('sections.manualHint'),
            empty: t('sections.empty'),
            addEntry: t('sections.addEntry'),
          },
          statuses,
          types,
          card: {
            edit: t('card.edit'),
            delete: t('card.delete'),
            deleteConfirm: t('card.deleteConfirm'),
            source: t('card.source'),
          },
          form: {
            addTitle: t('form.addTitle'),
            editTitle: t('form.editTitle'),
            type: t('form.type'),
            titleLabel: t('form.titleLabel'),
            titlePlaceholder: t('form.titlePlaceholder'),
            content: t('form.content'),
            contentPlaceholder: t('form.contentPlaceholder'),
            contentHint: t('form.contentHint'),
            charactersTemplate: t.raw('form.characters') as string,
            save: t('form.save'),
            saving: t('form.saving'),
            cancel: t('form.cancel'),
            saveError: t('form.saveError'),
            typeOptions,
          },
        }}
      />
    </main>
  );
}
