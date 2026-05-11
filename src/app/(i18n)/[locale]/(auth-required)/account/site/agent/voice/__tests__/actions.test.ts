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
  agentVoiceConfigsRepo,
  aiAgentsRepo,
  auditLogsRepo,
  resetStore,
  tenantsRepo,
} from '@/lib/data';
import {
  generateVoiceSample,
  selectVoice,
  updateVoiceSettings,
} from '@/app/(i18n)/[locale]/(auth-required)/account/site/agent/voice/actions';
import { provisionAgent } from '@/app/(i18n)/[locale]/(auth-required)/account/site/agent/actions';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';

function asOwner() {
  authState.userId = VILLA_OWNER_ID;
  authState.tenantId = VILLA_TENANT_ID;
}

describe('voice config server actions (step 57)', () => {
  beforeEach(() => {
    resetStore();
    asOwner();
  });
  afterEach(() => {
    resetStore();
  });

  async function ensureAgent() {
    const r = await provisionAgent();
    expect(r.success).toBe(true);
    return aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
  }

  describe('selectVoice', () => {
    it('happy path creates the voice config with seeded slider defaults', async () => {
      const agent = await ensureAgent();
      const r = await selectVoice({ voice_id: 'stub-voice-nl-anna' });
      expect(r.success).toBe(true);
      const cfg = await agentVoiceConfigsRepo.findByAgentId(agent!.id);
      expect(cfg).not.toBeNull();
      expect(cfg?.voice_id).toBe('stub-voice-nl-anna');
      expect(cfg?.voice_name).toBe('Anna');
      expect(cfg?.language).toBe('nl');
      expect(cfg?.stability).toBe(0.5);
      expect(cfg?.similarity_boost).toBe(0.75);
      expect(cfg?.style).toBe(0);
      expect(cfg?.speaker_boost).toBe(true);
    });

    it('emits an agent_voice_selected audit entry on success', async () => {
      await ensureAgent();
      await selectVoice({ voice_id: 'stub-voice-en-james' });
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, {
        limit: 50,
      });
      expect(audits.some((a) => a.action === 'agent_voice_selected')).toBe(true);
    });

    it('rejects unknown voice ids with voice_not_found', async () => {
      await ensureAgent();
      const r = await selectVoice({ voice_id: 'stub-voice-zz-xyz' });
      expect(r.success).toBe(false);
      expect(r.error).toBe('voice_not_found');
    });

    it('rejects empty voice_id with validation_failed', async () => {
      await ensureAgent();
      const r = await selectVoice({ voice_id: '' });
      expect(r.success).toBe(false);
      expect(r.error).toBe('validation_failed');
    });

    it('returns voice_not_available when the agent channel is text-only', async () => {
      const agent = await ensureAgent();
      // Demote the channel to mimic a Pro plan.
      await aiAgentsRepo.update(agent!.id, { channel: 'text' });
      const r = await selectVoice({ voice_id: 'stub-voice-nl-anna' });
      expect(r.success).toBe(false);
      expect(r.error).toBe('voice_not_available');
    });

    it('returns not_provisioned when no agent row exists yet', async () => {
      const r = await selectVoice({ voice_id: 'stub-voice-nl-anna' });
      expect(r.success).toBe(false);
      expect(r.error).toBe('not_provisioned');
    });

    it('returns feature_not_enabled when tenant.ai_agent_enabled is off', async () => {
      await ensureAgent();
      await tenantsRepo.update(VILLA_TENANT_ID, { ai_agent_enabled: false });
      const r = await selectVoice({ voice_id: 'stub-voice-nl-anna' });
      expect(r.success).toBe(false);
      expect(r.error).toBe('feature_not_enabled');
    });

    it('preserves existing slider values when swapping voices', async () => {
      const agent = await ensureAgent();
      await selectVoice({ voice_id: 'stub-voice-nl-anna' });
      await updateVoiceSettings({
        stability: 0.8,
        similarity_boost: 0.9,
        style: 0.3,
        speaker_boost: false,
      });
      const before = await agentVoiceConfigsRepo.findByAgentId(agent!.id);
      expect(before?.stability).toBe(0.8);

      // Swap to a different voice — sliders must not reset to defaults.
      await selectVoice({ voice_id: 'stub-voice-en-james' });
      const after = await agentVoiceConfigsRepo.findByAgentId(agent!.id);
      expect(after?.voice_id).toBe('stub-voice-en-james');
      expect(after?.stability).toBe(0.8);
      expect(after?.similarity_boost).toBe(0.9);
      expect(after?.style).toBe(0.3);
      expect(after?.speaker_boost).toBe(false);
    });
  });

  describe('updateVoiceSettings', () => {
    it('persists slider changes after selectVoice', async () => {
      const agent = await ensureAgent();
      await selectVoice({ voice_id: 'stub-voice-nl-pieter' });
      const r = await updateVoiceSettings({
        stability: 0.25,
        similarity_boost: 0.6,
        style: 0.5,
        speaker_boost: false,
      });
      expect(r.success).toBe(true);
      const cfg = await agentVoiceConfigsRepo.findByAgentId(agent!.id);
      expect(cfg?.stability).toBe(0.25);
      expect(cfg?.similarity_boost).toBe(0.6);
      expect(cfg?.style).toBe(0.5);
      expect(cfg?.speaker_boost).toBe(false);
    });

    it('returns validation_failed on out-of-range stability', async () => {
      await ensureAgent();
      await selectVoice({ voice_id: 'stub-voice-nl-anna' });
      const r = await updateVoiceSettings({
        stability: -0.1,
        similarity_boost: 0.75,
        style: 0,
        speaker_boost: true,
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('validation_failed');
    });

    it('returns validation_failed when similarity_boost exceeds 1', async () => {
      await ensureAgent();
      await selectVoice({ voice_id: 'stub-voice-nl-anna' });
      const r = await updateVoiceSettings({
        stability: 0.5,
        similarity_boost: 1.2,
        style: 0,
        speaker_boost: true,
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('validation_failed');
    });

    it('returns voice_not_found when no voice is selected yet', async () => {
      await ensureAgent();
      const r = await updateVoiceSettings({
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        speaker_boost: true,
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe('voice_not_found');
    });

    it('writes an agent_voice_settings_updated audit entry', async () => {
      await ensureAgent();
      await selectVoice({ voice_id: 'stub-voice-nl-anna' });
      await updateVoiceSettings({
        stability: 0.4,
        similarity_boost: 0.8,
        style: 0.2,
        speaker_boost: true,
      });
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, {
        limit: 50,
      });
      expect(audits.some((a) => a.action === 'agent_voice_settings_updated')).toBe(true);
    });
  });

  describe('generateVoiceSample', () => {
    it('returns the stub audio url in stub mode', async () => {
      await ensureAgent();
      const r = await generateVoiceSample({ voice_id: 'stub-voice-nl-anna' });
      expect(r.success).toBe(true);
      expect(r.audioUrl).toMatch(/silent-1s\.mp3$/);
    });

    it('returns validation_failed for an empty voice_id', async () => {
      await ensureAgent();
      const r = await generateVoiceSample({ voice_id: '' });
      expect(r.success).toBe(false);
      expect(r.error).toBe('validation_failed');
    });
  });
});
