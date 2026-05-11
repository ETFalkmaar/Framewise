'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuditAction } from '@/lib/admin';

interface FiltersCopy {
  title: string;
  dateFrom: string;
  dateTo: string;
  actionTypes: string;
  performedBy: string;
  search: string;
  reset: string;
  allActions: string;
  allUsers: string;
  actionLabels: Record<AuditAction, string>;
}

export interface AuditFiltersProps {
  initial: {
    dateFrom: string;
    dateTo: string;
    actionTypes: AuditAction[];
    performedByUserId: string;
    search: string;
    sortDir: 'asc' | 'desc';
  };
  uniqueActionTypes: AuditAction[];
  uniqueUsers: Array<{ id: string; name: string }>;
  copy: FiltersCopy;
}

/**
 * Filter bar for the dedicated audit log viewer (step 37, fase 11
 * part 3/4). Mirrors all state into the URL so a super-admin can
 * deep-link a filtered slice of the activity feed.
 *
 * The search input is debounced 300 ms so we don't push a new
 * URL on every keystroke. Dropdowns push immediately.
 */
export function AuditFilters({ initial, uniqueActionTypes, uniqueUsers, copy }: AuditFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [dateFrom, setDateFrom] = useState(initial.dateFrom);
  const [dateTo, setDateTo] = useState(initial.dateTo);
  const [actionType, setActionType] = useState<string>(
    initial.actionTypes.length === 1 ? initial.actionTypes[0]! : 'all'
  );
  const [userId, setUserId] = useState(initial.performedByUserId);
  const [search, setSearch] = useState(initial.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildHref = useMemo(
    () =>
      (next: {
        dateFrom?: string;
        dateTo?: string;
        actionType?: string;
        userId?: string;
        search?: string;
      }) => {
        const sp = new URLSearchParams(params?.toString() ?? '');
        const merged = {
          dateFrom: next.dateFrom ?? dateFrom,
          dateTo: next.dateTo ?? dateTo,
          actionType: next.actionType ?? actionType,
          userId: next.userId ?? userId,
          search: next.search ?? search,
        };
        for (const [key, value] of Object.entries(merged)) {
          if (!value || value === '' || value === 'all') sp.delete(key);
          else sp.set(key, value);
        }
        sp.delete('page');
        const q = sp.toString();
        return q.length === 0 ? pathname : `${pathname}?${q}`;
      },
    [pathname, params, dateFrom, dateTo, actionType, userId, search]
  );

  useEffect(() => {
    if (search === initial.search) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(buildHref({ search }));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const reset = () => {
    setDateFrom('');
    setDateTo('');
    setActionType('all');
    setUserId('');
    setSearch('');
    router.push(pathname);
  };

  return (
    <section
      data-testid="audit-filters"
      aria-label={copy.title}
      className="border-border bg-card mb-6 grid grid-cols-1 gap-3 rounded-md border p-4 md:grid-cols-[1fr_1fr_1fr_1fr_2fr_auto]"
    >
      <div className="space-y-1.5">
        <Label htmlFor="audit-date-from">{copy.dateFrom}</Label>
        <Input
          id="audit-date-from"
          data-testid="filter-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            router.push(buildHref({ dateFrom: e.target.value }));
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="audit-date-to">{copy.dateTo}</Label>
        <Input
          id="audit-date-to"
          data-testid="filter-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            router.push(buildHref({ dateTo: e.target.value }));
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="audit-action-type">{copy.actionTypes}</Label>
        <select
          id="audit-action-type"
          data-testid="filter-action-type"
          className="bg-background border-input h-9 w-full rounded-md border px-3 text-sm"
          value={actionType}
          onChange={(e) => {
            setActionType(e.target.value);
            router.push(buildHref({ actionType: e.target.value }));
          }}
        >
          <option value="all">{copy.allActions}</option>
          {uniqueActionTypes.map((a) => (
            <option key={a} value={a}>
              {copy.actionLabels[a]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="audit-user">{copy.performedBy}</Label>
        <select
          id="audit-user"
          data-testid="filter-user"
          className="bg-background border-input h-9 w-full rounded-md border px-3 text-sm"
          value={userId || 'all'}
          onChange={(e) => {
            const v = e.target.value === 'all' ? '' : e.target.value;
            setUserId(v);
            router.push(buildHref({ userId: v || 'all' }));
          }}
        >
          <option value="all">{copy.allUsers}</option>
          {uniqueUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="audit-search">{copy.search}</Label>
        <Input
          id="audit-search"
          data-testid="filter-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.search}
        />
      </div>

      <div className="flex items-end">
        <Button
          type="button"
          variant="outline"
          onClick={reset}
          data-testid="filter-reset"
          className="w-full md:w-auto"
        >
          {copy.reset}
        </Button>
      </div>
    </section>
  );
}
