'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import { agentSettingsRepo, agentVoiceConfigsRepo, aiAgentsRepo, auditLogsRepo } from '@/lib/data';
import { createElevenLabsClient } from '@/lib/elevenlabs/client';
import { getVoiceById } from '@/lib/elevenlabs/voice-catalog';
import { canConfigureAgent } from '@/lib/permissions/ai-agent';

/**
 * Voice config server actions (step 57, fase 15 part 2/9).
 *
 * Three operations:
 *  - `selectVoice` — pick a voice from the catalog; seeds default
 *    slider values when the row doesn't exist yet, otherwise keeps
 *    the existing settings (just swaps the id).
 *  - `updateVoiceSettings` — slider-only update for stability /
 *    similarity / style / speaker_boost.
 *  - `generateVoiceSample` — produces a preview audio URL the picker
 *    can play. Stub mode returns the shared silent mp3.
 *
 * All gated on `canConfigureAgent` AND require the agent's channel
 * to include voice (`voice` or `both`). Pro tenants (`text` only)
 * get a `voice_not_available` error so the UI can show the upgrade
 * prompt.
 */

export type VoiceActionError =
  | 'unauthenticated'
  | 'no_active_tenant'
  | 'forbidden'
  | 'feature_not_enabled'
  | 'voice_not_available'
  | 'not_provisioned'
  | 'voice_not_found'
  | 'validation_failed'
  | 'unknown_error';

export interface VoiceActionResult {
  success: boolean;
  audioUrl?: string;
  error?: VoiceActionError;
}

async function voiceContext() {
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
  // Voice config is only available when the agent runs on a voice
  // channel. Pro tenants land on `text` here and get the upgrade
  // prompt server-side.
  if (agent.channel === 'text') return { error: 'voice_not_available' as const };
  return { user, tenant, agent };
}

const selectVoiceSchema = z.object({
  voice_id: z.string().min(1),
});

export async function selectVoice(input: { voice_id: string }): Promise<VoiceActionResult> {
  const parsed = selectVoiceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'validation_failed' };

  const c = await voiceContext();
  if ('error' in c) return { success: false, error: c.error };

  const voice = getVoiceById(parsed.data.voice_id);
  if (!voice) return { success: false, error: 'voice_not_found' };

  const existing = await agentVoiceConfigsRepo.findByAgentId(c.agent.id);
  const upserted = await agentVoiceConfigsRepo.upsert(c.agent.id, {
    voice_id: voice.voice_id,
    voice_name: voice.name,
    language: voice.language,
    accent: voice.accent,
    gender: voice.gender,
    stability: existing?.stability ?? 0.5,
    similarity_boost: existing?.similarity_boost ?? 0.75,
    style: existing?.style ?? 0,
    speaker_boost: existing?.speaker_boost ?? true,
    sample_audio_url: voice.sample_url,
  });

  // Best-effort sync to ElevenLabs.
  if (c.agent.elevenlabs_agent_id) {
    try {
      const client = createElevenLabsClient();
      await client.updateVoiceSettings({
        agent_id: c.agent.elevenlabs_agent_id,
        voice_id: voice.voice_id,
        stability: upserted.stability,
        similarity_boost: upserted.similarity_boost,
        style: upserted.style,
        speaker_boost: upserted.speaker_boost,
      });
    } catch {
      /* live sync is best-effort */
    }
  }

  try {
    await auditLogsRepo.create({
      tenant_id: c.tenant.id,
      action: 'agent_voice_selected',
      performed_by_user_id: c.user.id,
      metadata: { agentId: c.agent.id, voiceId: voice.voice_id, voiceName: voice.name },
    });
  } catch {
    /* no-op */
  }
  try {
    revalidatePath('/account/site/agent/voice');
  } catch {
    /* no-op */
  }
  return { success: true };
}

const settingsSchema = z.object({
  stability: z.number().min(0).max(1),
  similarity_boost: z.number().min(0).max(1),
  style: z.number().min(0).max(1),
  speaker_boost: z.boolean(),
});

export type UpdateVoiceSettingsInput = z.infer<typeof settingsSchema>;

export async function updateVoiceSettings(
  input: UpdateVoiceSettingsInput
): Promise<VoiceActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'validation_failed' };

  const c = await voiceContext();
  if ('error' in c) return { success: false, error: c.error };

  const existing = await agentVoiceConfigsRepo.findByAgentId(c.agent.id);
  if (!existing) return { success: false, error: 'voice_not_found' };

  const updated = await agentVoiceConfigsRepo.patch(c.agent.id, parsed.data);

  if (c.agent.elevenlabs_agent_id) {
    try {
      const client = createElevenLabsClient();
      await client.updateVoiceSettings({
        agent_id: c.agent.elevenlabs_agent_id,
        voice_id: updated.voice_id,
        stability: updated.stability,
        similarity_boost: updated.similarity_boost,
        style: updated.style,
        speaker_boost: updated.speaker_boost,
      });
    } catch {
      /* no-op */
    }
  }

  try {
    await auditLogsRepo.create({
      tenant_id: c.tenant.id,
      action: 'agent_voice_settings_updated',
      performed_by_user_id: c.user.id,
      metadata: {
        agentId: c.agent.id,
        stability: updated.stability,
        similarity_boost: updated.similarity_boost,
        style: updated.style,
        speaker_boost: updated.speaker_boost,
      },
    });
  } catch {
    /* no-op */
  }
  try {
    revalidatePath('/account/site/agent/voice');
  } catch {
    /* no-op */
  }
  return { success: true };
}

const sampleSchema = z.object({
  voice_id: z.string().min(1),
  text: z.string().min(1).max(500).optional(),
});

export async function generateVoiceSample(input: {
  voice_id: string;
  text?: string;
}): Promise<VoiceActionResult> {
  const parsed = sampleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'validation_failed' };

  const c = await voiceContext();
  if ('error' in c) return { success: false, error: c.error };

  // If no override text supplied, use the agent's configured greeting.
  let text = parsed.data.text;
  if (!text) {
    const settings = await agentSettingsRepo.findByAgentId(c.agent.id);
    text = settings?.greeting_message ?? 'Hello.';
  }

  try {
    const client = createElevenLabsClient();
    const result = await client.generateVoiceSample({
      voice_id: parsed.data.voice_id,
      text,
    });
    return { success: true, audioUrl: result.audio_url };
  } catch {
    return { success: false, error: 'unknown_error' };
  }
}
