import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: 'a0000000-0000-0000-0000-000000000001' as string | null,
  tenantId: '11111111-1111-1111-1111-111111111111' as string | null,
}));

vi.mock('@/lib/auth', async () => {
  const real = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  const { tenantsRepo, usersRepo } = await import('@/lib/data');
  return {
    ...real,
    async getCurrentUser() {
      if (!authState.userId) return null;
      return usersRepo.findById(authState.userId);
    },
    async requireCurrentUser() {
      if (!authState.userId) throw new Error('unauth');
      const u = await usersRepo.findById(authState.userId);
      if (!u) throw new Error('unauth');
      return u;
    },
    async getActiveTenantForUser() {
      if (!authState.tenantId) return null;
      return tenantsRepo.findById(authState.tenantId);
    },
  };
});

import '@/lib/data';

import {
  aiAgentsRepo,
  auditLogsRepo,
  knowledgeBaseRepo,
  resetStore,
  tenantsRepo,
} from '@/lib/data';
import {
  addManualKnowledgeEntry,
  deleteKnowledgeEntry,
  syncKnowledgeBase,
  updateManualKnowledgeEntry,
} from '@/app/(i18n)/[locale]/(auth-required)/account/site/agent/knowledge/actions';
import { provisionAgent } from '@/app/(i18n)/[locale]/(auth-required)/account/site/agent/actions';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';

function asOwner() {
  authState.userId = VILLA_OWNER_ID;
  authState.tenantId = VILLA_TENANT_ID;
}

describe('knowledge base server actions (step 58)', () => {
  beforeEach(() => {
    resetStore();
    asOwner();
  });
  afterEach(() => resetStore());

  async function ensureAgent() {
    const r = await provisionAgent();
    expect(r.success).toBe(true);
    return aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
  }

  describe('syncKnowledgeBase', () => {
    it('first run creates one auto-synced doc per published villa page', async () => {
      await ensureAgent();
      const r = await syncKnowledgeBase();
      expect(r.success).toBe(true);
      expect(r.syncedCount ?? 0).toBeGreaterThan(0);
      expect(r.removedCount).toBe(0);
      const agent = await aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
      const docs = await knowledgeBaseRepo.listAutoSynced(agent!.id);
      expect(docs.length).toBeGreaterThan(0);
      for (const d of docs) {
        expect(d.created_by_user_id).toBeNull();
        expect(d.status).toBe('synced');
        expect(d.last_synced_at).not.toBeNull();
      }
    });

    it('second run with unchanged content reports zero synced', async () => {
      await ensureAgent();
      await syncKnowledgeBase();
      const second = await syncKnowledgeBase();
      expect(second.success).toBe(true);
      expect(second.syncedCount).toBe(0);
    });

    it('emits a knowledge_base_synced audit entry', async () => {
      await ensureAgent();
      await syncKnowledgeBase();
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, { limit: 50 });
      expect(audits.some((a) => a.action === 'knowledge_base_synced')).toBe(true);
    });

    it('returns feature_not_enabled when tenant.ai_agent_enabled is off', async () => {
      await ensureAgent();
      await tenantsRepo.update(VILLA_TENANT_ID, { ai_agent_enabled: false });
      const r = await syncKnowledgeBase();
      expect(r.success).toBe(false);
      expect(r.error).toBe('feature_not_enabled');
    });

    it('returns not_provisioned when no agent exists yet', async () => {
      const r = await syncKnowledgeBase();
      expect(r.success).toBe(false);
      expect(r.error).toBe('not_provisioned');
    });
  });

  describe('addManualKnowledgeEntry', () => {
    it('persists a manual entry with the calling user as creator', async () => {
      await ensureAgent();
      const r = await addManualKnowledgeEntry({
        title: 'Parkeren bij de villa',
        content: 'Er zijn 3 parkeerplaatsen beschikbaar voor gasten op het terrein.',
      });
      expect(r.success).toBe(true);
      const agent = await aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
      const manual = await knowledgeBaseRepo.listManualEntries(agent!.id);
      expect(manual.length).toBe(1);
      expect(manual[0].created_by_user_id).toBe(VILLA_OWNER_ID);
      expect(manual[0].type).toBe('manual_entry');
      expect(manual[0].title).toBe('Parkeren bij de villa');
    });

    it('accepts a custom type (pricing / contact_info)', async () => {
      await ensureAgent();
      await addManualKnowledgeEntry({
        title: 'Tarief overzicht',
        content: 'Onze tarieven variëren tussen €350 en €500 per nacht.',
        type: 'pricing',
      });
      const agent = await aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
      const manual = await knowledgeBaseRepo.listManualEntries(agent!.id);
      expect(manual[0].type).toBe('pricing');
    });

    it('rejects titles below the 3-char minimum', async () => {
      await ensureAgent();
      const r = await addManualKnowledgeEntry({
        title: 'ab',
        content: 'Inhoud die lang genoeg is.',
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('validation_failed');
    });

    it('rejects content above the 2000-char ceiling', async () => {
      await ensureAgent();
      const r = await addManualKnowledgeEntry({
        title: 'Te lang antwoord',
        content: 'x'.repeat(2001),
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('validation_failed');
    });

    it('emits a knowledge_entry_added audit entry', async () => {
      await ensureAgent();
      await addManualKnowledgeEntry({
        title: 'Audit test',
        content: 'Bewijs dat het audit log wordt geschreven.',
      });
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, { limit: 50 });
      expect(audits.some((a) => a.action === 'knowledge_entry_added')).toBe(true);
    });
  });

  describe('updateManualKnowledgeEntry', () => {
    it('updates title + content + emits an audit entry', async () => {
      await ensureAgent();
      const added = await addManualKnowledgeEntry({
        title: 'Origineel',
        content: 'Originele inhoud die lang genoeg is.',
      });
      expect(added.entryId).toBeTruthy();
      const r = await updateManualKnowledgeEntry({
        id: added.entryId!,
        title: 'Bijgewerkt',
        content: 'Nieuwe inhoud die ook lang genoeg is.',
      });
      expect(r.success).toBe(true);
      const doc = await knowledgeBaseRepo.findById(added.entryId!);
      expect(doc?.title).toBe('Bijgewerkt');
      expect(doc?.content).toBe('Nieuwe inhoud die ook lang genoeg is.');
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, { limit: 50 });
      expect(audits.some((a) => a.action === 'knowledge_entry_updated')).toBe(true);
    });

    it('refuses to edit an auto-synced document', async () => {
      await ensureAgent();
      await syncKnowledgeBase();
      const agent = await aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
      const auto = (await knowledgeBaseRepo.listAutoSynced(agent!.id))[0];
      expect(auto).toBeTruthy();
      const r = await updateManualKnowledgeEntry({
        id: auto.id,
        title: 'Hack poging',
        content: 'Mag niet kunnen via deze action.',
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('not_manual');
    });

    it('returns not_found for unknown ids', async () => {
      await ensureAgent();
      const r = await updateManualKnowledgeEntry({
        id: 'does-not-exist',
        title: 'Valid title',
        content: 'Content that is long enough.',
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('not_found');
    });
  });

  describe('deleteKnowledgeEntry', () => {
    it('removes a manual entry + writes the audit entry', async () => {
      await ensureAgent();
      const added = await addManualKnowledgeEntry({
        title: 'Wegwerp',
        content: 'Wordt zo verwijderd. Inhoud lang genoeg.',
      });
      const r = await deleteKnowledgeEntry({ id: added.entryId! });
      expect(r.success).toBe(true);
      expect(await knowledgeBaseRepo.findById(added.entryId!)).toBeNull();
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, { limit: 50 });
      expect(audits.some((a) => a.action === 'knowledge_entry_deleted')).toBe(true);
    });

    it('refuses to delete an auto-synced document', async () => {
      await ensureAgent();
      await syncKnowledgeBase();
      const agent = await aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
      const auto = (await knowledgeBaseRepo.listAutoSynced(agent!.id))[0];
      const r = await deleteKnowledgeEntry({ id: auto.id });
      expect(r.success).toBe(false);
      expect(r.error).toBe('not_manual');
    });
  });
});
