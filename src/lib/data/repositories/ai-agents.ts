import type { AIAgent, AgentStatus } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface AIAgentsRepository {
  findById(id: string): Promise<AIAgent | null>;
  findByTenantId(tenantId: string): Promise<AIAgent | null>;
  list(): Promise<AIAgent[]>;
  create(data: Omit<AIAgent, 'id' | 'created_at' | 'updated_at'>): Promise<AIAgent>;
  update(id: string, data: Partial<AIAgent>): Promise<AIAgent>;
  /** Convenience helper around `update` — stamps `status` + `last_error`. */
  updateStatus(id: string, status: AgentStatus, lastError?: string | null): Promise<AIAgent>;
  delete(id: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<AIAgentsRepository>('aiAgentsRepo');
export const aiAgentsRepo = proxy;
export const setAIAgentsRepo = set;
