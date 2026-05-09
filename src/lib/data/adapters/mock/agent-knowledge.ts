import type { AgentKnowledge } from '@/types/database';
import type { AgentKnowledgeRepository } from '../../repositories/agent-knowledge';
import { generateId, getTimestamp, table } from './store';

export const mockAgentKnowledgeRepo: AgentKnowledgeRepository = {
  async findByTenant(tenantId) {
    return Array.from(table('agent_knowledge').values()).filter((k) => k.tenant_id === tenantId);
  },
  async search(tenantId, query, limit = 10) {
    const lower = query.toLowerCase();
    return Array.from(table('agent_knowledge').values())
      .filter((k) => k.tenant_id === tenantId && k.content.toLowerCase().includes(lower))
      .slice(0, limit);
  },
  async upsert(data) {
    const now = getTimestamp();
    if (data.source_reference) {
      const existing = Array.from(table('agent_knowledge').values()).find(
        (k) => k.tenant_id === data.tenant_id && k.source_reference === data.source_reference
      );
      if (existing) {
        const updated: AgentKnowledge = { ...existing, ...data, updated_at: now };
        table('agent_knowledge').set(existing.id, updated);
        return updated;
      }
    }
    const row: AgentKnowledge = {
      ...data,
      id: generateId(),
      created_at: now,
      updated_at: now,
    };
    table('agent_knowledge').set(row.id, row);
    return row;
  },
  async delete(id) {
    if (!table('agent_knowledge').delete(id)) {
      throw new Error(`agent_knowledge: ${id} not found`);
    }
  },
};
