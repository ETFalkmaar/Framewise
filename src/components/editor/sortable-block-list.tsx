'use client';

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useTransition } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { countMissingTranslations } from '@/lib/editor/translation-status';
import type { Block, BlockType, LocaleCode, Media } from '@/types/database';

import { reorderBlocksAction } from '@/app/(i18n)/[locale]/(auth-required)/account/site/pages/[pageId]/edit/actions';

import { BlockEditModal } from './block-edit-modal';
import type { BlockEditModalProps } from './block-edit-modal';

const BLOCK_ICON: Record<BlockType, string> = {
  hero: '🦸',
  text: '📝',
  image: '🖼️',
  gallery: '🎞️',
  cta: '🔗',
  faq: '❓',
  pricing: '💰',
  contact: '📞',
};

interface SortableBlockListCopy {
  blockType: Record<BlockType, string>;
  editBlock: string;
  blockEditComingSoon: string;
  dragHandle: string;
  reordering: string;
  reorderError: string;
  /**
   * Precomputed singular/plural strings — the server component
   * can't pass a function across the RSC boundary, so we expand
   * the ICU plural at render time on the server and forward the
   * two variants to the client.
   */
  missingCountSingular: string;
  missingCountPlural: string;
}

export interface SortableBlockListProps {
  pageId: string;
  blocks: Block[];
  canEdit: boolean;
  locale: LocaleCode;
  mediaLibrary: Media[];
  copy: SortableBlockListCopy;
  modalCopy: BlockEditModalProps['copy'];
  /**
   * Step 45 — called whenever the local optimistic block list
   * changes (drag-reorder or block save). The parent (EditPageLayout)
   * mirrors this into a draft state shared with the preview iframe,
   * so the iframe can show uncommitted edits without waiting on
   * server revalidation.
   *
   * Optional so existing tests + the history-preview screen keep
   * working unchanged.
   */
  onBlocksChange?: (blocks: Block[]) => void;
}

/**
 * Drag-and-drop sortable list of blocks (step 40, fase 12 part 2/8).
 * Optimistic UI: when the user drops a block we reorder in
 * `useState` straight away, fire the server action via
 * `useTransition`, and roll back to the previous order if the
 * action fails. The drag handle is a separate button so a click
 * on the row body doesn't trigger a drag (still leaves the row
 * tappable for the upcoming step-41 inline editor).
 */
export function SortableBlockList({
  pageId,
  blocks: initial,
  canEdit,
  locale,
  mediaLibrary,
  copy,
  modalCopy,
  onBlocksChange,
}: SortableBlockListProps) {
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const editingBlock = editingBlockId
    ? (blocks.find((b) => b.id === editingBlockId) ?? null)
    : null;

  /**
   * Step 45 — keep the parent's draft state in sync. Wraps
   * `setBlocks` so every code path (drag, save, rollback) bubbles
   * the new list up. Callers without an `onBlocksChange` (history
   * preview, tests) get the original behaviour.
   */
  function applyBlocks(next: Block[]): void {
    setBlocks(next);
    onBlocksChange?.(next);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === String(active.id));
    const newIndex = blocks.findIndex((b) => b.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(blocks, oldIndex, newIndex);
    const previous = blocks;
    applyBlocks(next);

    startTransition(async () => {
      setError(null);
      const result = await reorderBlocksAction({
        pageId,
        newOrder: next.map((b) => b.id),
      });
      if (!result.success) {
        applyBlocks(previous);
        setError(result.error ?? copy.reorderError);
      }
    });
  }

  return (
    <div data-testid="sortable-block-list" data-can-edit={canEdit ? 'true' : 'false'}>
      {error && (
        <div
          data-testid="reorder-error"
          className="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-xs"
        >
          {error}
        </div>
      )}
      {pending && (
        <p data-testid="reorder-pending" className="text-muted-foreground mb-2 text-xs">
          {copy.reordering}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <ol className="grid gap-3">
            {blocks.map((block) => (
              <SortableBlockItem
                key={block.id}
                block={block}
                canEdit={canEdit}
                copy={copy}
                onEdit={() => setEditingBlockId(block.id)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {editingBlock && (
        <BlockEditModal
          block={editingBlock}
          pageId={pageId}
          locale={locale}
          mediaLibrary={mediaLibrary}
          open
          onClose={() => setEditingBlockId(null)}
          copy={modalCopy}
          onLocalSave={(blockId, newData) => {
            // Step 45 — optimistic merge so the live-preview iframe
            // reloads with the new content before the server action
            // returns. `newData` overwrites the same top-level keys
            // saveBlockContentFor would touch, so the local view
            // mirrors what'll soon land in the DB.
            applyBlocks(
              blocks.map((b) => (b.id === blockId ? { ...b, data: { ...b.data, ...newData } } : b))
            );
          }}
        />
      )}
    </div>
  );
}

function SortableBlockItem({
  block,
  canEdit,
  copy,
  onEdit,
}: {
  block: Block;
  canEdit: boolean;
  copy: SortableBlockListCopy;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} data-testid={`sortable-block-${block.id}`}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="flex min-w-0 items-center gap-3">
            {canEdit && (
              <button
                type="button"
                data-testid={`drag-handle-${block.id}`}
                aria-label={copy.dragHandle}
                className="text-muted-foreground hover:text-foreground cursor-grab font-mono text-lg select-none active:cursor-grabbing"
                {...attributes}
                {...listeners}
              >
                ⋮⋮
              </button>
            )}
            <span aria-hidden className="text-2xl leading-none">
              {BLOCK_ICON[block.block_type]}
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm">{copy.blockType[block.block_type]}</CardTitle>
              <CardDescription className="font-mono text-[11px]">
                {truncate(extractExcerpt(block.data), 80)}
              </CardDescription>
            </div>
          </div>
          <button
            type="button"
            data-testid={`block-edit-trigger-${block.id}`}
            onClick={onEdit}
            className="ring-border bg-background hover:bg-muted inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition"
          >
            {copy.editBlock}
          </button>
        </CardHeader>
        <CardContent className="text-muted-foreground flex items-center gap-2 pt-0 font-mono text-[10px]">
          <span>#{block.order_index}</span>
          {(() => {
            const missing = countMissingTranslations(block);
            if (missing === 0) return null;
            const template = missing === 1 ? copy.missingCountSingular : copy.missingCountPlural;
            return (
              <span
                data-testid={`missing-translations-${block.id}`}
                className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300"
              >
                <span aria-hidden>⚠</span>
                {template.replace('{count}', String(missing))}
              </span>
            );
          })()}
        </CardContent>
      </Card>
    </li>
  );
}

function extractExcerpt(data: Record<string, unknown>): string {
  const stack: unknown[] = [data];
  while (stack.length > 0) {
    const next = stack.pop();
    if (typeof next === 'string' && next.trim().length > 0) return next.trim();
    if (Array.isArray(next)) {
      for (let i = next.length - 1; i >= 0; i--) stack.push(next[i]);
    } else if (next && typeof next === 'object') {
      for (const v of Object.values(next as Record<string, unknown>)) stack.push(v);
    }
  }
  return '';
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
