import type { AgentConversation, AgentMessage } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface AgentConversationsRepository {
  findById(id: string): Promise<AgentConversation | null>;
  listByTenant(tenantId: string): Promise<AgentConversation[]>;
  create(
    data: Omit<AgentConversation, 'id' | 'started_at' | 'ended_at' | 'transcript' | 'tools_used'>
  ): Promise<AgentConversation>;
  append(id: string, message: AgentMessage): Promise<AgentConversation>;
  finalize(id: string, summary: string | null): Promise<AgentConversation>;
}

const { proxy, set } = createRepoProxy<AgentConversationsRepository>('agentConversationsRepo');
export const agentConversationsRepo = proxy;
export const setAgentConversationsRepo = set;
