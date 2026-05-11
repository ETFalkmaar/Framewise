import type { KnowledgeBaseDocument, KnowledgeSyncStatus } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface KnowledgeBaseRepository {
  findById(id: string): Promise<KnowledgeBaseDocument | null>;
  listByAgentId(agentId: string): Promise<KnowledgeBaseDocument[]>;
  /** Filter to `created_by_user_id === null` — site content the
   *  sync action manages. */
  listAutoSynced(agentId: string): Promise<KnowledgeBaseDocument[]>;
  /** Filter to manual entries (any non-null `created_by_user_id`). */
  listManualEntries(agentId: string): Promise<KnowledgeBaseDocument[]>;
  /** Find an auto-synced document by source page id (for sync dedupe). */
  findByPageId(agentId: string, pageId: string): Promise<KnowledgeBaseDocument | null>;
  create(
    data: Omit<KnowledgeBaseDocument, 'id' | 'created_at' | 'updated_at'>
  ): Promise<KnowledgeBaseDocument>;
  update(
    id: string,
    data: Partial<KnowledgeBaseDocument>
  ): Promise<KnowledgeBaseDocument>;
  updateStatus(
    id: string,
    status: KnowledgeSyncStatus,
    syncError?: string | null
  ): Promise<KnowledgeBaseDocument>;
  delete(id: string): Promise<void>;
  /** Bulk-remove every auto-synced doc tied to the given page. Used
   *  when the page is deleted so the agent doesn't keep stale info. */
  deleteByPageId(agentId: string, pageId: string): Promise<number>;
}

const { proxy, set } = createRepoProxy<KnowledgeBaseRepository>('knowledgeBaseRepo');
export const knowledgeBaseRepo = proxy;
export const setKnowledgeBaseRepo = set;
