import type { AgentSettings } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface AgentSettingsRepository {
  findByAgentId(agentId: string): Promise<AgentSettings | null>;
  upsert(
    agentId: string,
    settings: Omit<AgentSettings, 'agent_id' | 'created_at' | 'updated_at'>
  ): Promise<AgentSettings>;
  delete(agentId: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<AgentSettingsRepository>('agentSettingsRepo');
export const agentSettingsRepo = proxy;
export const setAgentSettingsRepo = set;
