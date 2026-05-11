'use client';

import { useState } from 'react';

import type { AuditAction, AuditLogEvent } from '@/lib/admin';

const ACTION_ICON: Record<AuditAction, string> = {
  tenant_created: '🆕',
  tenant_updated: '✏️',
  site_published: '🚀',
  site_unpublished: '🛠️',
  connection_added: '🔌',
  connection_removed: '⛔',
  domain_added: '🌐',
  domain_verified: '✅',
  checklist_item_completed: '☑️',
  member_invited: '👤',
};

export interface AuditRowProps {
  event: AuditLogEvent;
  actionLabel: string;
  detailsLabel: string;
  collapseLabel: string;
}

/**
 * Single row in the audit-log viewer table (step 37). Each row
 * is a tiny client component because the metadata expand state
 * is local and per-row — `useState` keeps the bundle small and
 * keeps the parent table renderable as a server component.
 */
export function AuditRow({ event, actionLabel, detailsLabel, collapseLabel }: AuditRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr data-testid={`audit-row-${event.id}`} className="border-border/40 border-b">
        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
          {formatTimestamp(event.createdAt)}
        </td>
        <td className="px-3 py-2 text-sm">
          <span className="mr-2" aria-hidden>
            {ACTION_ICON[event.action]}
          </span>
          {actionLabel}
        </td>
        <td className="text-muted-foreground px-3 py-2 text-sm">
          {event.performedByUserName ?? '—'}
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            data-testid={`audit-row-toggle-${event.id}`}
            onClick={() => setOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground font-mono text-xs underline"
            aria-expanded={open}
          >
            {open ? collapseLabel : detailsLabel}
          </button>
        </td>
      </tr>
      {open && (
        <tr
          data-testid={`audit-row-details-${event.id}`}
          className="bg-muted/30 border-border/40 border-b"
        >
          <td colSpan={4} className="px-3 py-3">
            <pre className="text-foreground/80 overflow-x-auto font-mono text-[11px] leading-relaxed">
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function formatTimestamp(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}
