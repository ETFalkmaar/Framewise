import type { AuditAction, AuditLogEvent } from '@/lib/admin';

import { AuditRow } from './audit-row';

interface TableCopy {
  empty: string;
  columns: {
    timestamp: string;
    action: string;
    performedBy: string;
    details: string;
  };
  actionLabels: Record<AuditAction, string>;
  detailsToggle: string;
  detailsCollapse: string;
}

export interface AuditTableProps {
  events: AuditLogEvent[];
  copy: TableCopy;
}

/**
 * Server-component shell for the audit-log table (step 37).
 * Renders the header row + dispatches each event to a tiny
 * client `<AuditRow />` that owns its expand/collapse state.
 */
export function AuditTable({ events, copy }: AuditTableProps) {
  if (events.length === 0) {
    return (
      <div
        data-testid="audit-table-empty"
        className="border-border bg-muted/20 text-muted-foreground rounded-md border p-8 text-center text-sm"
      >
        {copy.empty}
      </div>
    );
  }

  return (
    <div data-testid="audit-table" className="border-border overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-left">
        <thead className="bg-muted/40">
          <tr className="border-border/60 border-b">
            <Th>{copy.columns.timestamp}</Th>
            <Th>{copy.columns.action}</Th>
            <Th>{copy.columns.performedBy}</Th>
            <Th align="right">{copy.columns.details}</Th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <AuditRow
              key={event.id}
              event={event}
              actionLabel={copy.actionLabels[event.action]}
              detailsLabel={copy.detailsToggle}
              collapseLabel={copy.detailsCollapse}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      className={`text-muted-foreground px-3 py-2 text-xs font-semibold tracking-wide uppercase ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}
