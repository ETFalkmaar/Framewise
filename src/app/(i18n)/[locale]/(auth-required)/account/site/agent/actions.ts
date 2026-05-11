'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import {
  agentSettingsRepo,
  aiAgentsRepo,
  auditLogsRepo,
  subscriptionsRepo,
  tenantsRepo,
} from '@/lib/data';
import { createElevenLabsClient } from '@/lib/elevenlabs/client';
import { agentChannelsForPlan, canConfigureAgent } from '@/lib/permissions/ai-agent';
import type { AgentLanguage, AgentSettings } from '@/types/database';

/**
 * AI agent server actions (step 56, fase 15 part 1/9).
 *
 * Three operations:
 *  - `provisionAgent` — first-time activation. Creates the local row,
 *    calls ElevenLabs (or stubs it), persists the new agent id, fires
 *    the audit entry.
 *  - `updateAgentSettings` — mutate the per-agent persona/behaviour.
 *  - `deprovisionAgent` — soft-disable: drop the ElevenLabs link
 *    (best-effort delete) and reset status to `disabled` so the
 *    activation flow can be re-run cleanly.
 *
 * All gated on `canConfigureAgent` so editors can read but not
 * mutate. Errors are returned as typed strings — the UI maps them
 * to localised messages.
 */

export type AgentActionError =
  | 'unauthenticated'
  | 'no_active_tenant'
  | 'forbidden'
  | 'feature_not_enabled'
  | 'provisioning_failed'
  | 'not_provisioned'
  | 'validation_failed'
  | 'unknown_error';

export interface AgentActionResult {
  success: boolean;
  agentId?: string;
  elevenlabsAgentId?: string;
  mode?: 'live' | 'stub';
  error?: AgentActionError;
}

async function authedTenantContext() {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { error: 'unauthenticated' as const };
  }
  const tenant = await getActiveTenantForUser();
  if (!tenant) return { error: 'no_active_tenant' as const };
  // Surface a feature-flag denial before falling through to the
  // generic forbidden — gives the UI a more actionable error.
  if (!tenant.ai_agent_enabled) return { error: 'feature_not_enabled' as const };
  const allowed = await canConfigureAgent(user.id, tenant);
  if (!allowed) return { error: 'forbidden' as const };
  return { user, tenant };
}

function defaultSettings(
  agentId: string,
  tenantName: string,
  hasBookings: boolean
): Omit<AgentSettings, 'agent_id' | 'created_at' | 'updated_at'> {
  return {
    greeting_message: `Hallo! Ik ben de assistent van ${tenantName}. Hoe kan ik je helpen?`,
    personality: 'professional_warm',
    max_response_length: 300,
    forbidden_topics: [],
    can_take_bookings: hasBookings,
    can_share_pricing: true,
    can_provide_contact: true,
  };
}

/**
 * Provision (or re-provision) the agent for the current tenant.
 * Idempotent: returns success if the agent is already active.
 */
export async function provisionAgent(): Promise<AgentActionResult> {
  const c = await authedTenantContext();
  if ('error' in c) return { success: false, error: c.error };

  // Already provisioned + active → no-op.
  const existing = await aiAgentsRepo.findByTenantId(c.tenant.id);
  if (existing?.elevenlabs_agent_id && existing.status === 'active') {
    return {
      success: true,
      agentId: existing.id,
      elevenlabsAgentId: existing.elevenlabs_agent_id,
    };
  }

  const subscription = await subscriptionsRepo.findByTenant(c.tenant.id);
  const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;
  const channel = agentChannelsForPlan(plan?.code ?? null);
  const language: AgentLanguage = (c.tenant.default_locale as AgentLanguage | undefined) ?? 'nl';

  // Create or roll-forward the row, then flip to `provisioning`.
  let agent = existing;
  if (!agent) {
    agent = await aiAgentsRepo.create({
      tenant_id: c.tenant.id,
      elevenlabs_agent_id: null,
      name: `${c.tenant.name} Assistant`,
      channel,
      language,
      status: 'provisioning',
      last_error: null,
      provisioned_at: null,
    });
  } else {
    agent = await aiAgentsRepo.updateStatus(agent.id, 'provisioning');
  }

  // Seed defaults — leaves existing settings untouched if a row exists.
  const currentSettings = await agentSettingsRepo.findByAgentId(agent.id);
  const settingsToUse =
    currentSettings ??
    (await agentSettingsRepo.upsert(
      agent.id,
      defaultSettings(agent.id, c.tenant.name, c.tenant.bookings_enabled)
    ));

  // Call out (or stub).
  const client = createElevenLabsClient();
  try {
    const result = await client.createAgent({
      name: agent.name,
      first_message: settingsToUse.greeting_message,
      language: agent.language,
    });
    const ts = new Date().toISOString();
    const updated = await aiAgentsRepo.update(agent.id, {
      elevenlabs_agent_id: result.agent_id,
      status: 'active',
      last_error: null,
      provisioned_at: ts,
    });
    await tenantsRepo.update(c.tenant.id, { ai_agent_id: updated.id });
    try {
      await auditLogsRepo.create({
        tenant_id: c.tenant.id,
        action: 'ai_agent_provisioned',
        performed_by_user_id: c.user.id,
        metadata: {
          agentId: updated.id,
          elevenlabsAgentId: result.agent_id,
          mode: result.mode,
          channel: updated.channel,
        },
      });
    } catch {
      /* audit failures shouldn't break the provision */
    }
    try {
      revalidatePath('/account/site/agent');
    } catch {
      /* outside request scope */
    }
    return {
      success: true,
      agentId: updated.id,
      elevenlabsAgentId: result.agent_id,
      mode: result.mode,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await aiAgentsRepo.updateStatus(agent.id, 'error', message);
    try {
      await auditLogsRepo.create({
        tenant_id: c.tenant.id,
        action: 'ai_agent_error',
        performed_by_user_id: c.user.id,
        metadata: { agentId: agent.id, error: message },
      });
    } catch {
      /* no-op */
    }
    return { success: false, error: 'provisioning_failed' };
  }
}

/**
 * Deprovision the current tenant's agent. Best-effort delete in
 * ElevenLabs + status flip to `disabled` locally. The settings row
 * stays around so a future re-provision keeps the persona.
 */
export async function deprovisionAgent(): Promise<AgentActionResult> {
  const c = await authedTenantContext();
  if ('error' in c) return { success: false, error: c.error };

  const agent = await aiAgentsRepo.findByTenantId(c.tenant.id);
  if (!agent) return { success: false, error: 'not_provisioned' };

  const client = createElevenLabsClient();
  if (agent.elevenlabs_agent_id) {
    try {
      await client.deleteAgent(agent.elevenlabs_agent_id);
    } catch {
      /* swallow — local state still gets flipped */
    }
  }
  await aiAgentsRepo.update(agent.id, {
    status: 'disabled',
    elevenlabs_agent_id: null,
    provisioned_at: null,
  });
  await tenantsRepo.update(c.tenant.id, { ai_agent_id: null });
  try {
    await auditLogsRepo.create({
      tenant_id: c.tenant.id,
      action: 'ai_agent_deprovisioned',
      performed_by_user_id: c.user.id,
      metadata: { agentId: agent.id },
    });
  } catch {
    /* no-op */
  }
  try {
    revalidatePath('/account/site/agent');
  } catch {
    /* no-op */
  }
  return { success: true, agentId: agent.id };
}

const settingsSchema = z.object({
  greeting_message: z.string().min(1).max(500),
  personality: z.string().min(1).max(60),
  max_response_length: z.number().int().min(50).max(2000),
  forbidden_topics: z.array(z.string().max(60)).max(20),
  can_take_bookings: z.boolean(),
  can_share_pricing: z.boolean(),
  can_provide_contact: z.boolean(),
});

export type UpdateAgentSettingsInput = z.infer<typeof settingsSchema>;

/**
 * Mutate the persona/behaviour settings. Best-effort syncs the
 * greeting_message + language to ElevenLabs via `updateAgent` so the
 * voice/text experience matches the dashboard.
 */
export async function updateAgentSettings(
  input: UpdateAgentSettingsInput
): Promise<AgentActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'validation_failed' };

  const c = await authedTenantContext();
  if ('error' in c) return { success: false, error: c.error };

  const agent = await aiAgentsRepo.findByTenantId(c.tenant.id);
  if (!agent) return { success: false, error: 'not_provisioned' };

  await agentSettingsRepo.upsert(agent.id, parsed.data);

  // Best-effort live update.
  if (agent.elevenlabs_agent_id) {
    const client = createElevenLabsClient();
    try {
      await client.updateAgent(agent.elevenlabs_agent_id, {
        first_message: parsed.data.greeting_message,
        language: agent.language,
      });
    } catch {
      /* live update is best-effort */
    }
  }

  try {
    await auditLogsRepo.create({
      tenant_id: c.tenant.id,
      action: 'ai_agent_settings_updated',
      performed_by_user_id: c.user.id,
      metadata: { agentId: agent.id },
    });
  } catch {
    /* no-op */
  }
  try {
    revalidatePath('/account/site/agent');
  } catch {
    /* no-op */
  }
  return { success: true, agentId: agent.id };
}
