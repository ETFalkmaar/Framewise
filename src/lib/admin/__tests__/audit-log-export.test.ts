import { describe, expect, it } from 'vitest';

import type { AuditLogEvent } from '../audit-log-view';
import { CSV_BOM, buildAuditLogCsv, getCsvFilename } from '../audit-log-export';

const sampleEvent = (overrides: Partial<AuditLogEvent> = {}): AuditLogEvent => ({
  id: 'evt-1',
  tenantId: 'tenant-1',
  action: 'tenant_created',
  performedByUserId: 'user-1',
  performedByUserName: 'Alice Doe',
  metadata: { country: 'NL', plan: 'pro' },
  createdAt: '2026-05-09T14:23:45.000Z',
  ...overrides,
});

describe('buildAuditLogCsv', () => {
  it('starts with the UTF-8 BOM so Excel renders accents correctly', () => {
    const csv = buildAuditLogCsv([sampleEvent()]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
  });

  it('emits the column-header row before the data rows', () => {
    const csv = buildAuditLogCsv([]);
    const headerLine = csv.slice(CSV_BOM.length).split('\r\n')[0];
    expect(headerLine).toBe('Timestamp,Action,Performed By,User ID,Metadata');
  });

  it('emits one CSV row per event in input order', () => {
    const csv = buildAuditLogCsv([
      sampleEvent({ id: 'a', performedByUserName: 'Alice', metadata: { x: 1 } }),
      sampleEvent({ id: 'b', performedByUserName: 'Bob', metadata: { x: 2 } }),
    ]);
    const dataRows = csv.slice(CSV_BOM.length).split('\r\n').filter(Boolean).slice(1);
    expect(dataRows).toHaveLength(2);
    expect(dataRows[0]).toContain('Alice');
    expect(dataRows[1]).toContain('Bob');
  });

  it('quotes fields that contain commas', () => {
    const csv = buildAuditLogCsv([
      sampleEvent({ performedByUserName: 'Doe, Alice', metadata: { reason: 'ok' } }),
    ]);
    expect(csv).toContain('"Doe, Alice"');
  });

  it('quotes and double-escapes quotes inside fields', () => {
    const csv = buildAuditLogCsv([
      sampleEvent({ performedByUserName: 'A "quoted" name', metadata: {} }),
    ]);
    expect(csv).toContain('"A ""quoted"" name"');
  });

  it('serialises the metadata column as JSON', () => {
    const csv = buildAuditLogCsv([sampleEvent({ metadata: { country: 'NL', plan: 'pro' } })]);
    // Metadata field is quoted because the serialised JSON contains commas.
    expect(csv).toContain('"{""country"":""NL"",""plan"":""pro""}"');
  });

  it('uses CRLF line endings for cross-platform Excel compat', () => {
    const csv = buildAuditLogCsv([sampleEvent()]);
    expect(csv.includes('\r\n')).toBe(true);
  });

  it('substitutes empty strings for null performedBy fields', () => {
    const csv = buildAuditLogCsv([
      sampleEvent({ performedByUserId: null, performedByUserName: null }),
    ]);
    const dataRow = csv.slice(CSV_BOM.length).split('\r\n')[1] ?? '';
    // After `action,` two empty fields (`,,`) then the (quoted) JSON.
    expect(dataRow).toContain('tenant_created,,,"{');
  });
});

describe('getCsvFilename', () => {
  it('uses the YYYY-MM-DD date stamp + tenant slug', () => {
    const fname = getCsvFilename('demo-villa', new Date('2026-05-09T10:00:00Z'));
    expect(fname).toBe('audit-log-demo-villa-2026-05-09.csv');
  });

  it('lowercases + dashifies an unsafe slug', () => {
    const fname = getCsvFilename('Demo Villa!', new Date('2026-05-09T10:00:00Z'));
    expect(fname).toBe('audit-log-demo-villa--2026-05-09.csv');
  });

  it('falls back to a sane default if the slug is empty', () => {
    const fname = getCsvFilename('', new Date('2026-05-09T10:00:00Z'));
    expect(fname).toBe('audit-log-tenant-2026-05-09.csv');
  });
});
