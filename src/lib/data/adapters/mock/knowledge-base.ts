import type { KnowledgeBaseDocument, KnowledgeSyncStatus } from '@/types/database';
import type { KnowledgeBaseRepository } from '../../repositories/knowledge-base';
import { generateId, getTimestamp, table } from './store';

/**
 * Mock adapter for the knowledge base (step 58, fase 15 part 3/9).
 * Auto-synced + manual entries share the same store, distinguished
 * by `created_by_user_id` (null vs. user UUID).
 */
export const mockKnowledgeBaseRepo: KnowledgeBaseRepository = {
  async findById(id) {
    return table('knowledge_base_documents').get(id) ?? null;
  },

  async listByAgentId(agentId) {
    return Array.from(table('knowledge_base_documents').values())
      .filter((d) => d.agent_id === agentId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async listAutoSynced(agentId) {
    return Array.from(table('knowledge_base_documents').values())
      .filter((d) => d.agent_id === agentId && d.created_by_user_id === null)
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  async listManualEntries(agentId) {
    return Array.from(table('knowledge_base_documents').values())
      .filter((d) => d.agent_id === agentId && d.created_by_user_id !== null)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async findByPageId(agentId, pageId) {
    for (const d of table('knowledge_base_documents').values()) {
      if (d.agent_id === agentId && d.page_id === pageId && d.created_by_user_id === null) {
        return d;
      }
    }
    return null;
  },

  async create(data) {
    const now = getTimestamp();
    const row: KnowledgeBaseDocument = {
      ...data,
      id: generateId(),
      created_at: now,
      updated_at: now,
    };
    table('knowledge_base_documents').set(row.id, row);
    return row;
  },

  async update(id, data) {
    const existing = table('knowledge_base_documents').get(id);
    if (!existing) {
      throw new Error(`knowledge_base_documents: ${id} not found`);
    }
    const updated: KnowledgeBaseDocument = {
      ...existing,
      ...data,
      id,
      updated_at: getTimestamp(),
    };
    table('knowledge_base_documents').set(id, updated);
    return updated;
  },

  async updateStatus(id, status: KnowledgeSyncStatus, syncError = null) {
    return this.update(id, {
      status,
      sync_error: syncError ?? null,
    });
  },

  async delete(id) {
    table('knowledge_base_documents').delete(id);
  },

  async deleteByPageId(agentId, pageId) {
    const matching: string[] = [];
    for (const [id, doc] of table('knowledge_base_documents').entries()) {
      if (doc.agent_id === agentId && doc.page_id === pageId && doc.created_by_user_id === null) {
        matching.push(id);
      }
    }
    for (const id of matching) {
      table('knowledge_base_documents').delete(id);
    }
    return matching.length;
  },
};
