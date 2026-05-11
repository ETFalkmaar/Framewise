import type { AgentVoiceConfig } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface AgentVoiceConfigsRepository {
  findByAgentId(agentId: string): Promise<AgentVoiceConfig | null>;
  upsert(
    agentId: string,
    config: Omit<AgentVoiceConfig, 'agent_id' | 'created_at' | 'updated_at'>
  ): Promise<AgentVoiceConfig>;
  /** Partial update — used by the slider-only path so callers don't
   *  need to repeat the voice metadata. */
  patch(agentId: string, patch: Partial<AgentVoiceConfig>): Promise<AgentVoiceConfig>;
  delete(agentId: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<AgentVoiceConfigsRepository>('agentVoiceConfigsRepo');
export const agentVoiceConfigsRepo = proxy;
export const setAgentVoiceConfigsRepo = set;
