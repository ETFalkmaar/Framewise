import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { resetStore, tenantsRepo } from '@/lib/data';
import {
  agentChannelsForPlan,
  canConfigureAgent,
  canEnableAgent,
  canViewAgent,
} from '@/lib/permissions/ai-agent';
import type { Tenant } from '@/types/database';

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';
const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_TENANT_ID = '22222222-2222-2222-2222-222222222222';

async function villa(overrides: Partial<Tenant> = {}): Promise<Tenant> {
  const t = await tenantsRepo.findById(VILLA_TENANT_ID);
  return { ...(t as Tenant), ...overrides } as Tenant;
}

async function restaurant(overrides: Partial<Tenant> = {}): Promise<Tenant> {
  const t = await tenantsRepo.findById(RESTAURANT_TENANT_ID);
  return { ...(t as Tenant), ...overrides } as Tenant;
}

describe('AI agent permission gates (step 56)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  describe('canViewAgent', () => {
    it('super-admin bypasses the feature flag', async () => {
      const tenant = await villa({ ai_agent_enabled: false });
      await expect(canViewAgent(SUPER_ADMIN_ID, tenant)).resolves.toBe(true);
    });

    it("tenant editor sees the agent when the feature flag is on", async () => {
      const tenant = await villa({ ai_agent_enabled: true });
      await expect(canViewAgent(VILLA_OWNER_ID, tenant)).resolves.toBe(true);
    });

    it('feature flag off → editors are blocked', async () => {
      const tenant = await villa({ ai_agent_enabled: false });
      await expect(canViewAgent(VILLA_OWNER_ID, tenant)).resolves.toBe(false);
    });

    it('non-member cannot view another tenant', async () => {
      const tenant = await restaurant({ ai_agent_enabled: true });
      await expect(canViewAgent(VILLA_OWNER_ID, tenant)).resolves.toBe(false);
    });
  });

  describe('canConfigureAgent', () => {
    it('super-admin can configure anywhere', async () => {
      const tenant = await villa({ ai_agent_enabled: false });
      await expect(canConfigureAgent(SUPER_ADMIN_ID, tenant)).resolves.toBe(true);
    });

    it('owner can configure when the feature flag is on', async () => {
      const tenant = await villa({ ai_agent_enabled: true });
      await expect(canConfigureAgent(VILLA_OWNER_ID, tenant)).resolves.toBe(true);
    });

    it('feature flag off → owner blocked', async () => {
      const tenant = await villa({ ai_agent_enabled: false });
      await expect(canConfigureAgent(VILLA_OWNER_ID, tenant)).resolves.toBe(false);
    });
  });

  describe('canEnableAgent', () => {
    it('super-admin only', () => {
      expect(canEnableAgent(SUPER_ADMIN_ID)).toBe(true);
      expect(canEnableAgent(VILLA_OWNER_ID)).toBe(false);
    });
  });

  describe('agentChannelsForPlan', () => {
    it('enterprise → both', () => {
      expect(agentChannelsForPlan('enterprise')).toBe('both');
    });
    it('pro → text', () => {
      expect(agentChannelsForPlan('pro')).toBe('text');
    });
    it('basic → text (UI still gates via ai_agent_enabled)', () => {
      expect(agentChannelsForPlan('basic')).toBe('text');
    });
    it('null plan → text (safe default)', () => {
      expect(agentChannelsForPlan(null)).toBe('text');
    });
  });
});
