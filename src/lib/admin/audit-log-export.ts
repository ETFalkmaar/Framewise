import type { AuditLogEvent } from './audit-log-view';

/**
 * CSV builder for the audit-log viewer's "Export" button
 * (step 37, fase 11 part 3/4). Excel is the most common
 * downstream — it expects a UTF-8 BOM to render accented
 * characters correctly, and RFC 4180 quoting for commas /
 * quotes / newlines inside fields.
 *
 * The metadata column is `JSON.stringify(metadata)` — readable
 * for a human, and round-trippable for tooling that wants to
 * parse it back.
 */
export const CSV_BOM = '﻿';
const CSV_HEADERS = ['Timestamp', 'Action', 'Performed By', 'User ID', 'Metadata'];

export function buildAuditLogCsv(events: AuditLogEvent[]): string {
  const lines: string[] = [];
  lines.push(CSV_HEADERS.map(csvEscape).join(','));
  for (const event of events) {
    lines.push(
      [
        event.createdAt,
        event.action,
        event.performedByUserName ?? '',
        event.performedByUserId ?? '',
        JSON.stringify(event.metadata),
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

/**
 * Tenant-aware, date-stamped filename for the download. ASCII-
 * sanitises the slug so the result is filesystem-safe across
 * browsers + OSes (Windows in particular bans `<>:"/\|?*`).
 */
export function getCsvFilename(tenantSlug: string, now: Date = new Date()): string {
  const safeSlug = tenantSlug.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'tenant';
  const date = now.toISOString().slice(0, 10);
  return `audit-log-${safeSlug}-${date}.csv`;
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
