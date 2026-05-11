'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import type { AuditAction } from '@/lib/admin';

import { exportAuditLogCsvAction } from '@/app/(i18n)/[locale]/(auth-required)/admin/tenants/[tenantId]/audit/actions';

export interface ExportCsvButtonProps {
  tenantId: string;
  filters: {
    dateFrom?: string;
    dateTo?: string;
    actionTypes?: AuditAction[];
    performedByUserId?: string;
    searchQuery?: string;
    sortDir?: 'asc' | 'desc';
  };
  copy: {
    cta: string;
    pending: string;
    error: string;
  };
}

/**
 * Client island that triggers a CSV download of the currently
 * filtered audit log (step 37). Calls the server action to build
 * the CSV body server-side, then synthesises a Blob + anchor
 * click in the browser to actually save the file — that side-
 * steps the "server can't send raw bytes via a server action"
 * limitation.
 */
export function ExportCsvButton({ tenantId, filters, copy }: ExportCsvButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        data-testid="export-csv-button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const { csvContent, filename } = await exportAuditLogCsvAction({
                tenantId,
                ...filters,
              });
              triggerDownload(csvContent, filename);
            } catch (err) {
              setError(err instanceof Error ? err.message : copy.error);
            }
          });
        }}
      >
        {pending ? `⏳ ${copy.pending}` : `⬇ ${copy.cta}`}
      </Button>
      {error && (
        <span data-testid="export-csv-error" className="text-destructive text-xs">
          {error}
        </span>
      )}
    </div>
  );
}

function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
