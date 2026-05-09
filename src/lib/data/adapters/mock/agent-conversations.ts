import type { AgentConversation, AgentMessage } from '@/types/database';
import type { AgentConversationsRepository } from '../../repositories/agent-conversations';
import { generateId, getTimestamp, table } from './store';

export const mockAgentConversationsRepo: AgentConversationsRepository = {
  async findById(id) {
    return table('agent_conversations').get(id) ?? null;
  },
  async listByTenant(tenantId) {
    return Array.from(table('agent_conversations').values())
      .filter((c) => c.tenant_id === tenantId)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
  },
  async create(data) {
    const row: AgentConversation = {
      ...data,
      id: generateId(),
      started_at: getTimestamp(),
      ended_at: null,
      transcript: [],
      tools_used: [],
    };
    table('agent_conversations').set(row.id, row);
    return row;
  },
  async append(id, message: AgentMessage) {
    const existing = table('agent_conversations').get(id);
    if (!existing) throw new Error(`agent_conversations: ${id} not found`);
    const updated: AgentConversation = {
      ...existing,
      transcript: [...existing.transcript, message],
      tools_used:
        message.role === 'tool' && message.tool_name
          ? Array.from(new Set([...existing.tools_used, message.tool_name]))
          : existing.tools_used,
    };
    table('agent_conversations').set(id, updated);
    return updated;
  },
  async finalize(id, summary) {
    const existing = table('agent_conversations').get(id);
    if (!existing) throw new Error(`agent_conversations: ${id} not found`);
    const updated: AgentConversation = {
      ...existing,
      ended_at: getTimestamp(),
      summary,
    };
    table('agent_conversations').set(id, updated);
    return updated;
  },
};
