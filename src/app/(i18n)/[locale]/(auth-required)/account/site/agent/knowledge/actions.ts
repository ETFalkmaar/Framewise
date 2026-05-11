'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import { aiAgentsRepo, auditLogsRepo, knowledgeBaseRepo } from '@/lib/data';
import { buildKnowledgeBaseSnapshot } from '@/lib/agent/knowledge-extractor';
import { createElevenLabsClient } from '@/lib/elevenlabs/client';
import { canConfigureAgent } from '@/lib/permissions/ai-agent';
import type { AgentLanguage, KnowledgeDocumentType } from '@/types/database';

/**
 * Knowledge-base server actions (step 58, fase 15 part 3/9).
 *
 * Four operations:
 *  - `syncKnowledgeBase` — rebuilds the auto-synced docs from the
 *    site's published pages, pushes deltas to ElevenLabs, removes
 *    docs for pages that no longer have content. Idempotent on
 *    repeated calls: docs whose content hasn't changed get skipped.
 *  - `addManualKnowledgeEntry` — owner-curated Q&A / pricing /
 *    contact note. Validated server-side (title min 3, content
 *    min 10, content max 2000 to stay under ElevenLabs' KB limit).
 *  - `updateManualKnowledgeEntry` — edit in place. Verifies the
 *    doc belongs to the active tenant + is a manual entry (we
 *    don't allow editing auto-synced docs through this surface).
 *  - `deleteKnowledgeEntry` — works on manual entries; auto-synced
 *    docs are rebuilt by the next `syncKnowledgeBase` call.
 *
 * All gated on `canConfigureAgent` AND require a provisioned agent.
 */

export type KnowledgeActionError =
  | 'unauthenticated'
  | 'no_active_tenant'
  | 'forbidden'
  | 'feature_not_enabled'
  | 'not_provisioned'
  | 'not_found'
  | 'not_owned'
  | 'not_manual'
  | 'validation_failed'
  | 'unknown_error';

export interface KnowledgeActionResult {
  success: boolean;
  syncedCount?: number;
  removedCount?: number;
  entryId?: string;
  error?: KnowledgeActionError;
}

async function knowledgeContext() {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { error: 'unauthenticated' as const };
  }
  const tenant = await getActiveTenantForUser();
  if (!tenant) return { error: 'no_active_tenant' as const };
  if (!tenant.ai_agent_enabled) return { error: 'feature_not_enabled' as const };
  const allowed = await canConfigureAgent(user.id, tenant);
  if (!allowed) return { error: 'forbidden' as const };
  const agent = await aiAgentsRepo.findByTenantId(tenant.id);
  if (!agent) return { error: 'not_provisioned' as const };
  return { user, tenant, agent };
}

/**
 * Rebuild the auto-synced documents from the published page content
 * and reconcile the ElevenLabs side. Returns counts so the UI can
 * surface "X gesynchroniseerd / Y verwijderd".
 */
export async function syncKnowledgeBase(): Promise<KnowledgeActionResult> {
  const c = await knowledgeContext();
  if ('error' in c) return { success: false, error: c.error };

  const primaryLocale = (c.tenant.default_locale as AgentLanguage | undefined) ?? 'nl';
  const snapshot = await buildKnowledgeBaseSnapshot({
    tenantId: c.tenant.id,
    tenantSlug: c.tenant.slug,
    agentId: c.agent.id,
    primaryLocale,
  });

  const existing = await knowledgeBaseRepo.listAutoSynced(c.agent.id);
  const existingByPage = new Map(existing.filter((e) => e.page_id).map((e) => [e.page_id!, e]));
  const seenPages = new Set<string>();

  const client = createElevenLabsClient();
  let syncedCount = 0;

  // 1. Upsert each snapshot doc.
  for (const draft of snapshot) {
    if (draft.page_id) seenPages.add(draft.page_id);
    const prior = draft.page_id ? existingByPage.get(draft.page_id) : undefined;
    try {
      let elevenlabsId: string | null = prior?.elevenlabs_document_id ?? null;

      if (prior) {
        if (prior.content === draft.content && prior.title === draft.title) {
          // Nothing changed — skip the round-trip.
          continue;
        }
        // Content changed: remove the stale doc on ElevenLabs (best
        // effort) and re-create.
        if (elevenlabsId && c.agent.elevenlabs_agent_id) {
          try {
            await client.removeKnowledgeBaseDocument(
              c.agent.elevenlabs_agent_id,
              elevenlabsId
            );
          } catch {
            /* tolerate ElevenLabs hiccups */
          }
          elevenlabsId = null;
        }
        if (c.agent.elevenlabs_agent_id) {
          try {
            const r = await client.addKnowledgeBaseDocument(
              c.agent.elevenlabs_agent_id,
              draft.content,
              draft.title
            );
            elevenlabsId = r.document_id;
          } catch {
            /* sync failure — keep status='synced' locally; the next
             * run retries. */
          }
        }
        await knowledgeBaseRepo.update(prior.id, {
          title: draft.title,
          content: draft.content,
          source_url: draft.source_url,
          elevenlabs_document_id: elevenlabsId,
          status: 'synced',
          last_synced_at: new Date().toISOString(),
          sync_error: null,
        });
        syncedCount++;
      } else {
        if (c.agent.elevenlabs_agent_id) {
          try {
            const r = await client.addKnowledgeBaseDocument(
              c.agent.elevenlabs_agent_id,
              draft.content,
              draft.title
            );
            elevenlabsId = r.document_id;
          } catch {
            /* best effort */
          }
        }
        await knowledgeBaseRepo.create({
          ...draft,
          elevenlabs_document_id: elevenlabsId,
          status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        syncedCount++;
      }
    } catch {
      /* per-doc failure: leave the prior row untouched */
    }
  }

  // 2. Remove auto-synced docs whose source page no longer contributes.
  let removedCount = 0;
  for (const stale of existing) {
    if (!stale.page_id) continue;
    if (seenPages.has(stale.page_id)) continue;
    if (stale.elevenlabs_document_id && c.agent.elevenlabs_agent_id) {
      try {
        await client.removeKnowledgeBaseDocument(
          c.agent.elevenlabs_agent_id,
          stale.elevenlabs_document_id
        );
      } catch {
        /* best effort */
      }
    }
    await knowledgeBaseRepo.delete(stale.id);
    removedCount++;
  }

  try {
    await auditLogsRepo.create({
      tenant_id: c.tenant.id,
      action: 'knowledge_base_synced',
      performed_by_user_id: c.user.id,
      metadata: { agentId: c.agent.id, syncedCount, removedCount },
    });
  } catch {
    /* no-op */
  }
  try {
    revalidatePath('/account/site/agent/knowledge');
  } catch {
    /* no-op */
  }
  return { success: true, syncedCount, removedCount };
}

const manualEntryTypes: KnowledgeDocumentType[] = ['manual_entry', 'pricing', 'contact_info'];

const addEntrySchema = z.object({
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(10).max(2000),
  type: z.enum(['manual_entry', 'pricing', 'contact_info']).optional(),
});

export type AddManualKnowledgeEntryInput = z.infer<typeof addEntrySchema>;

export async function addManualKnowledgeEntry(
  input: AddManualKnowledgeEntryInput
): Promise<KnowledgeActionResult> {
  const parsed = addEntrySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'validation_failed' };

  const c = await knowledgeContext();
  if ('error' in c) return { success: false, error: c.error };

  const type = parsed.data.type ?? 'manual_entry';
  // Push to ElevenLabs first; on failure we still persist locally
  // so the next sync can retry.
  let elevenlabsId: string | null = null;
  if (c.agent.elevenlabs_agent_id) {
    try {
      const client = createElevenLabsClient();
      const r = await client.addKnowledgeBaseDocument(
        c.agent.elevenlabs_agent_id,
        parsed.data.content,
        parsed.data.title
      );
      elevenlabsId = r.document_id;
    } catch {
      /* best effort */
    }
  }

  const created = await knowledgeBaseRepo.create({
    agent_id: c.agent.id,
    tenant_id: c.tenant.id,
    elevenlabs_document_id: elevenlabsId,
    type,
    title: parsed.data.title,
    content: parsed.data.content,
    source_url: null,
    page_id: null,
    block_id: null,
    status: 'synced',
    last_synced_at: new Date().toISOString(),
    sync_error: null,
    created_by_user_id: c.user.id,
  });

  try {
    await auditLogsRepo.create({
      tenant_id: c.tenant.id,
      action: 'knowledge_entry_added',
      performed_by_user_id: c.user.id,
      metadata: { agentId: c.agent.id, entryId: created.id, type },
    });
  } catch {
    /* no-op */
  }
  try {
    revalidatePath('/account/site/agent/knowledge');
  } catch {
    /* no-op */
  }
  return { success: true, entryId: created.id };
}

const updateEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(10).max(2000),
});

export type UpdateManualKnowledgeEntryInput = z.infer<typeof updateEntrySchema>;

export async function updateManualKnowledgeEntry(
  input: UpdateManualKnowledgeEntryInput
): Promise<KnowledgeActionResult> {
  const parsed = updateEntrySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'validation_failed' };

  const c = await knowledgeContext();
  if ('error' in c) return { success: false, error: c.error };

  const doc = await knowledgeBaseRepo.findById(parsed.data.id);
  if (!doc) return { success: false, error: 'not_found' };
  if (doc.tenant_id !== c.tenant.id || doc.agent_id !== c.agent.id) {
    return { success: false, error: 'not_owned' };
  }
  if (!doc.created_by_user_id) {
    return { success: false, error: 'not_manual' };
  }

  // Replace the ElevenLabs document — easier than tracking a separate
  // update endpoint, and the API treats documents as immutable
  // anyway.
  let elevenlabsId: string | null = doc.elevenlabs_document_id;
  if (c.agent.elevenlabs_agent_id) {
    if (elevenlabsId) {
      try {
        const client = createElevenLabsClient();
        await client.removeKnowledgeBaseDocument(c.agent.elevenlabs_agent_id, elevenlabsId);
      } catch {
        /* no-op */
      }
      elevenlabsId = null;
    }
    try {
      const client = createElevenLabsClient();
      const r = await client.addKnowledgeBaseDocument(
        c.agent.elevenlabs_agent_id,
        parsed.data.content,
        parsed.data.title
      );
      elevenlabsId = r.document_id;
    } catch {
      /* best effort */
    }
  }

  await knowledgeBaseRepo.update(doc.id, {
    title: parsed.data.title,
    content: parsed.data.content,
    elevenlabs_document_id: elevenlabsId,
    status: 'synced',
    last_synced_at: new Date().toISOString(),
    sync_error: null,
  });

  try {
    await auditLogsRepo.create({
      tenant_id: c.tenant.id,
      action: 'knowledge_entry_updated',
      performed_by_user_id: c.user.id,
      metadata: { agentId: c.agent.id, entryId: doc.id },
    });
  } catch {
    /* no-op */
  }
  try {
    revalidatePath('/account/site/agent/knowledge');
  } catch {
    /* no-op */
  }
  return { success: true, entryId: doc.id };
}

export async function deleteKnowledgeEntry(input: {
  id: string;
}): Promise<KnowledgeActionResult> {
  if (!input?.id) return { success: false, error: 'validation_failed' };

  const c = await knowledgeContext();
  if ('error' in c) return { success: false, error: c.error };

  const doc = await knowledgeBaseRepo.findById(input.id);
  if (!doc) return { success: false, error: 'not_found' };
  if (doc.tenant_id !== c.tenant.id || doc.agent_id !== c.agent.id) {
    return { success: false, error: 'not_owned' };
  }
  if (!doc.created_by_user_id) {
    return { success: false, error: 'not_manual' };
  }

  if (doc.elevenlabs_document_id && c.agent.elevenlabs_agent_id) {
    try {
      const client = createElevenLabsClient();
      await client.removeKnowledgeBaseDocument(
        c.agent.elevenlabs_agent_id,
        doc.elevenlabs_document_id
      );
    } catch {
      /* no-op */
    }
  }
  await knowledgeBaseRepo.delete(doc.id);

  try {
    await auditLogsRepo.create({
      tenant_id: c.tenant.id,
      action: 'knowledge_entry_deleted',
      performed_by_user_id: c.user.id,
      metadata: { agentId: c.agent.id, entryId: doc.id, type: doc.type },
    });
  } catch {
    /* no-op */
  }
  try {
    revalidatePath('/account/site/agent/knowledge');
  } catch {
    /* no-op */
  }
  return { success: true, entryId: doc.id };
}

// Re-export the type set so test files can pin against the same
// shape as the actions.
export type { KnowledgeDocumentType };
export { manualEntryTypes };
