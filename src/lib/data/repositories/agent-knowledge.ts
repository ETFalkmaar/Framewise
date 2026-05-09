import type { AgentKnowledge } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface AgentKnowledgeRepository {
  findByTenant(tenantId: string): Promise<AgentKnowledge[]>;
  /** Text-based search for the mock adapter; replaced with pgvector later. */
  search(tenantId: string, query: string, limit?: number): Promise<AgentKnowledge[]>;
  upsert(data: Omit<AgentKnowledge, 'id' | 'created_at' | 'updated_at'>): Promise<AgentKnowledge>;
  delete(id: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<AgentKnowledgeRepository>('agentKnowledgeRepo');
export const agentKnowledgeRepo = proxy;
export const setAgentKnowledgeRepo = set;
