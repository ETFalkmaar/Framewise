'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from '@/i18n/navigation';
import type { Tenant } from '@/types/database';

interface SwitcherCopy {
  selectClient: string;
  searchPlaceholder: string;
  recent: string;
  allTenants: string;
  noResults: string;
}

export interface TenantSwitcherProps {
  currentTenantId: string | null;
  recentTenants: Tenant[];
  allTenants: Tenant[];
  copy: SwitcherCopy;
}

/**
 * Persistent header dropdown that lets the super-admin jump
 * between tenants without going through `/admin/tenants` (step
 * 38). Shows "Recent bezocht" up top + a full filterable list
 * underneath. Closing the popover doesn't reset the search so
 * accidentally clicking outside doesn't lose context.
 */
export function TenantSwitcher({
  currentTenantId,
  recentTenants,
  allTenants,
  copy,
}: TenantSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const current = useMemo(
    () => allTenants.find((t) => t.id === currentTenantId) ?? null,
    [allTenants, currentTenantId]
  );

  const filteredAll = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTenants;
    return allTenants.filter((t) =>
      [t.name, t.slug, t.custom_domain ?? ''].some((c) => c.toLowerCase().includes(q))
    );
  }, [allTenants, query]);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent): void {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function navigate(tenantId: string): void {
    setOpen(false);
    router.push(`/admin/tenants/${tenantId}`);
  }

  return (
    <div ref={containerRef} data-testid="tenant-switcher" className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="tenant-switcher-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="ring-border bg-background hover:bg-muted inline-flex max-w-[280px] items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
      >
        <span className="truncate">{current?.name ?? copy.selectClient}</span>
        <span aria-hidden className="text-muted-foreground">
          ▾
        </span>
      </button>

      {open && (
        <div
          data-testid="tenant-switcher-popover"
          className="bg-background ring-border absolute top-full right-0 z-50 mt-1 w-80 rounded-md shadow-lg ring-1"
        >
          <div className="border-border/60 border-b p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
              data-testid="tenant-switcher-search"
              className="bg-background border-input w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {recentTenants.length > 0 && query.trim() === '' && (
              <Section title={copy.recent} testId="switcher-section-recent">
                {recentTenants.map((t) => (
                  <Row
                    key={t.id}
                    tenant={t}
                    active={t.id === currentTenantId}
                    onSelect={() => navigate(t.id)}
                  />
                ))}
              </Section>
            )}

            <Section title={copy.allTenants} testId="switcher-section-all">
              {filteredAll.length === 0 ? (
                <p
                  data-testid="tenant-switcher-empty"
                  className="text-muted-foreground px-3 py-2 text-xs"
                >
                  {copy.noResults}
                </p>
              ) : (
                filteredAll.map((t) => (
                  <Row
                    key={t.id}
                    tenant={t}
                    active={t.id === currentTenantId}
                    onSelect={() => navigate(t.id)}
                  />
                ))
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <div data-testid={testId} className="space-y-0.5">
      <p className="text-muted-foreground px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wide uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({
  tenant,
  active,
  onSelect,
}: {
  tenant: Tenant;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`tenant-switcher-item-${tenant.id}`}
      className={`hover:bg-muted flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
        active ? 'bg-muted/60' : ''
      }`}
    >
      <span className="truncate font-medium">{tenant.name}</span>
      <span className="text-muted-foreground truncate font-mono text-[10px]">
        {tenant.custom_domain ?? tenant.slug}
      </span>
    </button>
  );
}
