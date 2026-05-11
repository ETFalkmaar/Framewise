'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from '@/i18n/navigation';
import type { SearchResult, SearchResultType } from '@/lib/admin';
import { useKeyboardShortcut } from '@/lib/hooks/use-keyboard-shortcut';

import { globalSearchAction } from '@/app/(i18n)/[locale]/(auth-required)/admin/actions';

interface SearchCopy {
  trigger: string;
  shortcut: string;
  placeholder: string;
  noResults: string;
  categories: Record<SearchResultType, string>;
}

export interface GlobalSearchBarProps {
  copy: SearchCopy;
}

/**
 * Header search trigger + modal (step 38). Cmd+K (macOS) /
 * Ctrl+K (everywhere else) opens the modal; Escape closes it;
 * Enter on a focused result navigates. Results are grouped by
 * type ("Klanten", "Sites", "Connectoren"). The trigger button
 * is always visible so super-admins who don't know the hotkey
 * can still discover the feature.
 */
export function GlobalSearchBar({ copy }: GlobalSearchBarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcut('k', () => setOpen(true), { meta: true });

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      // Schedule the reset asynchronously so the effect itself
      // stays free of synchronous state mutations.
      const id = setTimeout(() => setResults([]), 0);
      return () => clearTimeout(id);
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await globalSearchAction(q);
        if (!cancelled) setResults(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [open, query]);

  function navigate(url: string): void {
    setOpen(false);
    setQuery('');
    router.push(url);
  }

  const grouped: Record<SearchResultType, SearchResult[]> = {
    tenant: [],
    site: [],
    connection: [],
  };
  for (const r of results) grouped[r.type].push(r);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="global-search-trigger"
        aria-label={copy.trigger}
        className="ring-border bg-background hover:bg-muted text-muted-foreground inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs ring-1 transition"
      >
        <span>🔍</span>
        <span>{copy.trigger}</span>
        <kbd className="bg-muted text-muted-foreground hidden rounded px-1 py-0.5 font-mono text-[10px] md:inline">
          {copy.shortcut}
        </kbd>
      </button>

      {open && (
        <div
          data-testid="global-search-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-background ring-border w-full max-w-xl rounded-lg shadow-xl ring-1">
            <div className="border-border/60 border-b p-3">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.placeholder}
                data-testid="global-search-input"
                className="bg-background border-input w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {loading ? (
                <p className="text-muted-foreground px-3 py-4 text-center text-xs">…</p>
              ) : results.length === 0 ? (
                <p
                  data-testid="global-search-empty"
                  className="text-muted-foreground px-3 py-4 text-center text-xs"
                >
                  {query.trim().length < 2 ? '' : copy.noResults}
                </p>
              ) : (
                (Object.keys(grouped) as SearchResultType[]).map((type) =>
                  grouped[type].length === 0 ? null : (
                    <div key={type} data-testid={`global-search-group-${type}`} className="mb-1">
                      <p className="text-muted-foreground px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wide uppercase">
                        {copy.categories[type]}
                      </p>
                      <ul className="space-y-0.5">
                        {grouped[type].map((r) => (
                          <li key={`${r.type}-${r.id}`}>
                            <button
                              type="button"
                              onClick={() => navigate(r.url)}
                              data-testid={`global-search-result-${r.id}`}
                              className="hover:bg-muted flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{r.title}</span>
                                {r.subtitle && (
                                  <span className="text-muted-foreground block truncate font-mono text-[10px]">
                                    {r.subtitle}
                                  </span>
                                )}
                              </span>
                              <span className="text-muted-foreground font-mono text-[10px]">↵</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
