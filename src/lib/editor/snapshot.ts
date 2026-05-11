import { blocksRepo, pageVersionsRepo } from '@/lib/data';
import type { Block, PageVersion } from '@/types/database';

/**
 * Captures the current state of a page (all its blocks) into a
 * `page_versions` row so a customer can preview / restore later
 * (step 44, fase 12 part 6/8). Called by the save actions BEFORE
 * they mutate the underlying data:
 *
 *   const snapshot = await createPageSnapshot({...currentState...});
 *   await blocksRepo.update(...);
 *
 * The snapshot is best-effort — if writing the version row throws,
 * the caller logs and proceeds with the actual save. Loss of one
 * snapshot is annoying; loss of the customer's edit is much worse.
 */
export interface CreatePageSnapshotInput {
  pageId: string;
  createdByUserId: string;
  /** Short human-readable summary stored in `comment`. */
  changeSummary: string;
}

export async function createPageSnapshot(
  input: CreatePageSnapshotInput
): Promise<PageVersion | null> {
  try {
    const blocks = await blocksRepo.findByPageId(input.pageId);
    const count = await pageVersionsRepo.countByPage(input.pageId);
    return await pageVersionsRepo.create({
      page_id: input.pageId,
      version_number: count + 1,
      snapshot: { blocks: serialiseBlocks(blocks) },
      created_by_user_id: input.createdByUserId,
      comment: input.changeSummary,
    });
  } catch (err) {
    // Best-effort. Log + swallow so the main save proceeds.
    // eslint-disable-next-line no-console
    console.error('[createPageSnapshot] failed', err);
    return null;
  }
}

/**
 * Strip mutable Map / Date references so the JSON snapshot round-
 * trips cleanly through `Record<string, unknown>` storage. The
 * mock adapter is in-memory so this is mostly a no-op today; the
 * Supabase swap-in (step 119) lands here on disk via JSONB so the
 * pre-serialisation is good hygiene to keep.
 */
function serialiseBlocks(blocks: Block[]): unknown[] {
  return blocks.map((b) => ({
    id: b.id,
    page_id: b.page_id,
    block_type: b.block_type,
    order_index: b.order_index,
    data: b.data,
    created_at: b.created_at,
    updated_at: b.updated_at,
  }));
}

export function blocksFromSnapshot(snapshot: Record<string, unknown>): Block[] {
  const raw = snapshot.blocks;
  if (!Array.isArray(raw)) return [];
  return raw.filter((b): b is Block => {
    if (b === null || typeof b !== 'object') return false;
    const obj = b as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.page_id === 'string' &&
      typeof obj.block_type === 'string' &&
      typeof obj.order_index === 'number'
    );
  });
}
