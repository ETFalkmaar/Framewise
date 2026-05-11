import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock `@/lib/auth` so the actions can run outside a Next request.
// `vi.hoisted` lets the test bodies tweak the active user / tenant
// between cases without re-applying the mock factory each time.
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
  agentSettingsRepo,
  aiAgentsRepo,
  auditLogsRepo,
  resetStore,
  tenantsRepo,
} from '@/lib/data';
import {
  deprovisionAgent,
  provisionAgent,
  updateAgentSettings,
} from '@/app/(i18n)/[locale]/(auth-required)/account/site/agent/actions';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';
const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';

function asOwner() {
  authState.userId = VILLA_OWNER_ID;
  authState.tenantId = VILLA_TENANT_ID;
}

function asSuperAdmin() {
  authState.userId = SUPER_ADMIN_ID;
  authState.tenantId = VILLA_TENANT_ID;
}

function asAnonymous() {
  authState.userId = null;
  authState.tenantId = null;
}

describe('AI agent server actions (step 56)', () => {
  beforeEach(() => {
    resetStore();
    asOwner();
  });
  afterEach(() => {
    resetStore();
  });

  describe('provisionAgent', () => {
    it('happy path creates an agent + settings + audit (stub mode)', async () => {
      const result = await provisionAgent();
      expect(result.success).toBe(true);
      expect(result.agentId).toBeTruthy();
      expect(result.elevenlabsAgentId).toMatch(/^stub-agent-/);
      expect(result.mode).toBe('stub');

      const agent = await aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
      expect(agent?.status).toBe('active');
      expect(agent?.elevenlabs_agent_id).toBeTruthy();
      expect(agent?.provisioned_at).toBeTruthy();

      const settings = await agentSettingsRepo.findByAgentId(agent!.id);
      expect(settings).toBeTruthy();
      expect(settings?.greeting_message).toContain('Demo Villa');

      const tenant = await tenantsRepo.findById(VILLA_TENANT_ID);
      expect(tenant?.ai_agent_id).toBe(agent?.id);

      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, {
        limit: 50,
      });
      expect(audits.some((a) => a.action === 'ai_agent_provisioned')).toBe(true);
    });

    it('is idempotent — second call returns the existing agent', async () => {
      const first = await provisionAgent();
      const second = await provisionAgent();
      expect(second.success).toBe(true);
      expect(second.agentId).toBe(first.agentId);
      expect(second.elevenlabsAgentId).toBe(first.elevenlabsAgentId);
    });

    it("blocks when the tenant doesn't have ai_agent_enabled", async () => {
      await tenantsRepo.update(VILLA_TENANT_ID, { ai_agent_enabled: false });
      const result = await provisionAgent();
      expect(result.success).toBe(false);
      expect(result.error).toBe('feature_not_enabled');
    });

    it('blocks unauthenticated callers', async () => {
      asAnonymous();
      const result = await provisionAgent();
      expect(result.success).toBe(false);
      expect(result.error).toBe('unauthenticated');
    });

    it('super-admin can provision on behalf of the tenant', async () => {
      asSuperAdmin();
      const result = await provisionAgent();
      expect(result.success).toBe(true);
    });

    it('picks the channel from the tenant plan (enterprise → both)', async () => {
      const result = await provisionAgent();
      expect(result.success).toBe(true);
      const agent = await aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
      // Demo Villa ships on the enterprise plan in the seeds.
      expect(agent?.channel).toBe('both');
    });

    it('writes default can_take_bookings=true when tenant has bookings_enabled', async () => {
      await provisionAgent();
      const agent = await aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
      const settings = await agentSettingsRepo.findByAgentId(agent!.id);
      expect(settings?.can_take_bookings).toBe(true);
    });
  });

  describe('deprovisionAgent', () => {
    it('flips status to disabled + clears the elevenlabs link', async () => {
      const first = await provisionAgent();
      expect(first.success).toBe(true);
      const result = await deprovisionAgent();
      expect(result.success).toBe(true);
      const agent = await aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
      expect(agent?.status).toBe('disabled');
      expect(agent?.elevenlabs_agent_id).toBeNull();
      const tenant = await tenantsRepo.findById(VILLA_TENANT_ID);
      expect(tenant?.ai_agent_id).toBeNull();
    });

    it('emits an ai_agent_deprovisioned audit entry', async () => {
      await provisionAgent();
      await deprovisionAgent();
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, {
        limit: 50,
      });
      expect(audits.some((a) => a.action === 'ai_agent_deprovisioned')).toBe(true);
    });

    it('returns not_provisioned when no agent exists yet', async () => {
      const result = await deprovisionAgent();
      expect(result.success).toBe(false);
      expect(result.error).toBe('not_provisioned');
    });
  });

  describe('updateAgentSettings', () => {
    it('persists new settings and writes an audit entry', async () => {
      const provision = await provisionAgent();
      expect(provision.success).toBe(true);
      const result = await updateAgentSettings({
        greeting_message: 'Hoi! Welkom bij Demo Villa.',
        personality: 'casual_friendly',
        max_response_length: 250,
        forbidden_topics: ['competitor names'],
        can_take_bookings: true,
        can_share_pricing: false,
        can_provide_contact: true,
      });
      expect(result.success).toBe(true);
      const agent = await aiAgentsRepo.findByTenantId(VILLA_TENANT_ID);
      const settings = await agentSettingsRepo.findByAgentId(agent!.id);
      expect(settings?.greeting_message).toBe('Hoi! Welkom bij Demo Villa.');
      expect(settings?.personality).toBe('casual_friendly');
      expect(settings?.can_share_pricing).toBe(false);
      expect(settings?.forbidden_topics).toEqual(['competitor names']);
      const audits = await auditLogsRepo.listByTenant(VILLA_TENANT_ID, {
        limit: 50,
      });
      expect(audits.some((a) => a.action === 'ai_agent_settings_updated')).toBe(true);
    });

    it('returns validation_failed for an empty greeting', async () => {
      await provisionAgent();
      const result = await updateAgentSettings({
        greeting_message: '',
        personality: 'professional_warm',
        max_response_length: 300,
        forbidden_topics: [],
        can_take_bookings: true,
        can_share_pricing: true,
        can_provide_contact: true,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('validation_failed');
    });

    it('returns not_provisioned if no agent exists yet', async () => {
      const result = await updateAgentSettings({
        greeting_message: 'Hoi.',
        personality: 'professional_warm',
        max_response_length: 300,
        forbidden_topics: [],
        can_take_bookings: false,
        can_share_pricing: true,
        can_provide_contact: true,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('not_provisioned');
    });
  });
});
