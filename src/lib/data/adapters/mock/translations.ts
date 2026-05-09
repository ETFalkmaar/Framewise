import type { Translation } from '@/types/database';
import type { TranslationsRepository } from '../../repositories/translations';
import { generateId, getTimestamp, table } from './store';

export const mockTranslationsRepo: TranslationsRepository = {
  async findByReference(tenantId, namespace, referenceId) {
    return Array.from(table('translations').values()).filter(
      (t) => t.tenant_id === tenantId && t.namespace === namespace && t.reference_id === referenceId
    );
  },
  async upsert(tenantId, namespace, referenceId, locale, content) {
    const existing = Array.from(table('translations').values()).find(
      (t) =>
        t.tenant_id === tenantId &&
        t.namespace === namespace &&
        t.reference_id === referenceId &&
        t.locale === locale
    );
    const now = getTimestamp();
    if (existing) {
      const updated: Translation = { ...existing, content, updated_at: now };
      table('translations').set(existing.id, updated);
      return updated;
    }
    const row: Translation = {
      id: generateId(),
      tenant_id: tenantId,
      namespace,
      reference_id: referenceId,
      locale,
      content,
      updated_at: now,
    };
    table('translations').set(row.id, row);
    return row;
  },
  async delete(id) {
    if (!table('translations').delete(id)) {
      throw new Error(`translations: ${id} not found`);
    }
  },
};
