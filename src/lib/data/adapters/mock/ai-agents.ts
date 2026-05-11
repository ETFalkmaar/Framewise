import type { AIAgent, AgentStatus } from '@/types/database';
import type { AIAgentsRepository } from '../../repositories/ai-agents';
import { generateId, getTimestamp, table } from './store';

/**
 * Mock adapter for the AI agent repository (step 56, fase 15 part 1/9).
 * One agent per tenant — `findByTenantId` returns the singleton, the
 * provision flow creates the row when missing.
 */
export const mockAIAgentsRepo: AIAgentsRepository = {
  async findById(id) {
    return table('ai_agents').get(id) ?? null;
  },

  async findByTenantId(tenantId) {
    for (const row of table('ai_agents').values()) {
      if (row.tenant_id === tenantId) return row;
    }
    return null;
  },

  async list() {
    return Array.from(table('ai_agents').values()).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
  },

  async create(data) {
    const now = getTimestamp();
    const row: AIAgent = {
      ...data,
      id: generateId(),
      created_at: now,
      updated_at: now,
    };
    table('ai_agents').set(row.id, row);
    return row;
  },

  async update(id, data) {
    const existing = table('ai_agents').get(id);
    if (!existing) {
      throw new Error(`ai_agents: ${id} not found`);
    }
    const updated: AIAgent = {
      ...existing,
      ...data,
      id,
      updated_at: getTimestamp(),
    };
    table('ai_agents').set(id, updated);
    return updated;
  },

  async updateStatus(id, status: AgentStatus, lastError = null) {
    return this.update(id, {
      status,
      last_error: lastError ?? null,
    });
  },

  async delete(id) {
    table('ai_agents').delete(id);
  },
};
