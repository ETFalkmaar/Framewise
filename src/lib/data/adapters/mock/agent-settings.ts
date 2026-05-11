import type { AgentSettings } from '@/types/database';
import type { AgentSettingsRepository } from '../../repositories/agent-settings';
import { getTimestamp, table } from './store';

/**
 * Mock adapter for per-agent settings (step 56, fase 15 part 1/9).
 * `agent_id` is the primary key — settings rows have a 1-to-1
 * relation with `ai_agents`. `upsert` lets the provision action
 * write defaults without first checking whether the row exists.
 */
export const mockAgentSettingsRepo: AgentSettingsRepository = {
  async findByAgentId(agentId) {
    return table('agent_settings').get(agentId) ?? null;
  },

  async upsert(agentId, settings) {
    const now = getTimestamp();
    const existing = table('agent_settings').get(agentId);
    const row: AgentSettings = {
      ...settings,
      agent_id: agentId,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    table('agent_settings').set(agentId, row);
    return row;
  },

  async delete(agentId) {
    table('agent_settings').delete(agentId);
  },
};
