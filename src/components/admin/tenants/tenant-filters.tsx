'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FilterCopy {
  search: string;
  status: string;
  country: string;
  plan: string;
  reset: string;
  statusOptions: {
    all: string;
    onboarding: string;
    live: string;
    paused: string;
    cancelled: string;
  };
  countryOptions: { all: string; NL: string; CW: string };
  planOptions: { all: string; basic: string; pro: string; enterprise: string };
}

export interface TenantFiltersProps {
  initial: {
    search: string;
    status: string;
    country: string;
    plan: string;
  };
  copy: FilterCopy;
}

/**
 * Client-side filter bar that mirrors its state into the URL
 * query string so super-admins can share a filtered view. The
 * search box is debounced 300 ms to avoid a server round-trip on
 * every keystroke. Re-rendering the page is left to Next's
 * built-in shallow routing.
 */
export function TenantFilters({ initial, copy }: TenantFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(initial.search);
  const [status, setStatus] = useState(initial.status);
  const [country, setCountry] = useState(initial.country);
  const [plan, setPlan] = useState(initial.plan);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildHref = useMemo(
    () => (next: { search?: string; status?: string; country?: string; plan?: string }) => {
      const sp = new URLSearchParams(params?.toString() ?? '');
      const merged = {
        search: next.search ?? search,
        status: next.status ?? status,
        country: next.country ?? country,
        plan: next.plan ?? plan,
      };
      for (const [key, value] of Object.entries(merged)) {
        if (!value || value === '' || value === 'all') sp.delete(key);
        else sp.set(key, value);
      }
      // Filter changes reset paging.
      sp.delete('page');
      const query = sp.toString();
      return query.length === 0 ? pathname : `${pathname}?${query}`;
    },
    [pathname, params, search, status, country, plan]
  );

  // Debounce only the search input — selects push immediately.
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
    setSearch('');
    setStatus('all');
    setCountry('all');
    setPlan('all');
    router.push(pathname);
  };

  return (
    <div
      data-testid="tenant-filters"
      className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
    >
      <div className="space-y-1.5">
        <Label htmlFor="search">{copy.search}</Label>
        <Input
          id="search"
          data-testid="filter-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.search}
        />
      </div>
      <SelectField
        id="status"
        label={copy.status}
        value={status}
        onChange={(v) => {
          setStatus(v);
          router.push(buildHref({ status: v }));
        }}
        options={[
          { value: 'all', label: copy.statusOptions.all },
          { value: 'onboarding', label: copy.statusOptions.onboarding },
          { value: 'live', label: copy.statusOptions.live },
          { value: 'paused', label: copy.statusOptions.paused },
          { value: 'cancelled', label: copy.statusOptions.cancelled },
        ]}
      />
      <SelectField
        id="country"
        label={copy.country}
        value={country}
        onChange={(v) => {
          setCountry(v);
          router.push(buildHref({ country: v }));
        }}
        options={[
          { value: 'all', label: copy.countryOptions.all },
          { value: 'NL', label: copy.countryOptions.NL },
          { value: 'CW', label: copy.countryOptions.CW },
        ]}
      />
      <SelectField
        id="plan"
        label={copy.plan}
        value={plan}
        onChange={(v) => {
          setPlan(v);
          router.push(buildHref({ plan: v }));
        }}
        options={[
          { value: 'all', label: copy.planOptions.all },
          { value: 'basic', label: copy.planOptions.basic },
          { value: 'pro', label: copy.planOptions.pro },
          { value: 'enterprise', label: copy.planOptions.enterprise },
        ]}
      />
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
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        data-testid={`filter-${id}`}
        className="bg-background border-input h-9 w-full rounded-md border px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
