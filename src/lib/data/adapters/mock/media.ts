import type { Media } from '@/types/database';
import {
  mediaInsertSchema,
  parseOrThrow,
  ValidationError,
  VALIDATION_ERROR_CODES,
} from '@/lib/validation';
import type { MediaRepository } from '../../repositories/media';
import { generateId, getTimestamp, table } from './store';

export const mockMediaRepo: MediaRepository = {
  async findById(id) {
    return table('media').get(id) ?? null;
  },

  async listByTenant(tenantId) {
    return Array.from(table('media').values())
      .filter((m) => m.tenant_id === tenantId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async create(data) {
    const parsed = parseOrThrow(mediaInsertSchema, data);
    const row: Media = {
      ...parsed,
      // Zod's record schema may drop unspecified locales; normalise to all 3.
      alt_text: {
        nl: parsed.alt_text.nl ?? '',
        fr: parsed.alt_text.fr ?? '',
        en: parsed.alt_text.en ?? '',
      },
      width: parsed.width,
      height: parsed.height,
      id: generateId(),
      created_at: getTimestamp(),
    };
    table('media').set(row.id, row);
    return row;
  },

  async delete(id) {
    if (!table('media').delete(id)) {
      throw new ValidationError(VALIDATION_ERROR_CODES.NOT_FOUND, `media: ${id} not found`, {
        field: 'id',
      });
    }
  },
};
