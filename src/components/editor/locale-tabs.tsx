'use client';

import { useState } from 'react';

import type { LocaleCode } from '@/types/database';

import { SUPPORTED_LOCALES, isTranslationMissing } from '@/lib/editor/translation-status';

interface LocaleTabsCopy {
  tabLabels: Record<LocaleCode, string>;
  missingLabel: string;
}

export interface LocaleTabsProps {
  values: Record<LocaleCode, string>;
  onChange: (locale: LocaleCode, value: string) => void;
  renderField: (
    value: string,
    onChange: (next: string) => void,
    locale: LocaleCode
  ) => React.ReactNode;
  defaultLocale?: LocaleCode;
  copy: LocaleTabsCopy;
  /**
   * Optional id-prefix so a single form can host multiple
   * LocaleTabs instances (e.g. the hero form has 3 sets) with
   * unique data-testid attributes.
   */
  testidPrefix?: string;
}

/**
 * Tab bar that swaps an inner field between NL / FR / EN
 * locales (step 43, fase 12 part 5/8). Used by the block-edit
 * forms to give customers a single place to edit all three
 * locales per field — each tab carries its own copy of the
 * inner widget (a TipTap editor, a plain text input, …).
 *
 * Empty / TipTap-empty values flag the tab with an amber dot
 * so the customer can see at a glance which locales still need
 * a translation. The active tab gets an underline accent.
 */
export function LocaleTabs({
  values,
  onChange,
  renderField,
  defaultLocale = 'nl',
  copy,
  testidPrefix,
}: LocaleTabsProps) {
  const [active, setActive] = useState<LocaleCode>(defaultLocale);
  const prefix = testidPrefix ? `${testidPrefix}-` : '';

  return (
    <div data-testid={`${prefix}locale-tabs`}>
      <div className="border-border/60 mb-3 flex gap-1 border-b" role="tablist">
        {SUPPORTED_LOCALES.map((locale) => {
          const missing = isTranslationMissing(values[locale]);
          const isActive = active === locale;
          return (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`${prefix}locale-tab-${locale}`}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => setActive(locale)}
              className={`flex items-center gap-2 px-3 py-1.5 font-mono text-xs ${
                isActive
                  ? 'border-primary text-foreground -mb-px border-b-2 font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{copy.tabLabels[locale]}</span>
              {missing && (
                <span
                  aria-label={copy.missingLabel}
                  title={copy.missingLabel}
                  data-testid={`${prefix}missing-badge-${locale}`}
                  className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                />
              )}
            </button>
          );
        })}
      </div>

      <div data-testid={`${prefix}locale-tab-panel-${active}`}>
        {renderField(values[active] ?? '', (next) => onChange(active, next), active)}
      </div>
    </div>
  );
}
