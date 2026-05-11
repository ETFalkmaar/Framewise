import type { AgentVoiceConfig } from '@/types/database';
import type { AgentVoiceConfigsRepository } from '../../repositories/agent-voice-configs';
import { getTimestamp, table } from './store';

/**
 * Mock adapter for per-agent voice config (step 57, fase 15 part 2/9).
 * Singleton keyed on agent_id — `upsert` keeps the provision /
 * configure flow terse (no "does this row exist?" branching at the
 * call site).
 */
export const mockAgentVoiceConfigsRepo: AgentVoiceConfigsRepository = {
  async findByAgentId(agentId) {
    return table('agent_voice_configs').get(agentId) ?? null;
  },

  async upsert(agentId, config) {
    const now = getTimestamp();
    const existing = table('agent_voice_configs').get(agentId);
    const row: AgentVoiceConfig = {
      ...config,
      agent_id: agentId,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    table('agent_voice_configs').set(agentId, row);
    return row;
  },

  async patch(agentId, patch) {
    const existing = table('agent_voice_configs').get(agentId);
    if (!existing) {
      throw new Error(`agent_voice_configs: ${agentId} not found`);
    }
    const updated: AgentVoiceConfig = {
      ...existing,
      ...patch,
      agent_id: agentId,
      updated_at: getTimestamp(),
    };
    table('agent_voice_configs').set(agentId, updated);
    return updated;
  },

  async delete(agentId) {
    table('agent_voice_configs').delete(agentId);
  },
};
