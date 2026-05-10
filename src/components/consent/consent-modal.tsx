'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { DEFAULT_DENY, useConsent } from './consent-provider';
import type { ConsentChoices } from '@/lib/consent';

/**
 * Wrapper that mounts the modal contents only when the modal is
 * open. Mounting on demand means `useState(choices)` re-initialises
 * each time the user opens the dialog, so we don't need an effect
 * to sync the pending form state with the saved choices.
 */
export function ConsentModal() {
  const { showModal } = useConsent();
  if (!showModal) return null;
  return <ConsentModalDialog />;
}

/**
 * Granular cookie preferences dialog. Opens from the banner's
 * "Customise" button or the footer's "Cookie settings" link.
 * `Necessary` is locked on; `Analytics` and `Marketing` start in
 * the user's last-saved state (or `false` if never saved).
 */
function ConsentModalDialog() {
  const t = useTranslations('consent.modal');
  const { choices, setChoices, closeModal } = useConsent();
  const [pending, setPending] = useState<ConsentChoices>(choices);

  return (
    <div
      data-testid="consent-modal"
      role="dialog"
      aria-modal="true"
      aria-label={t('aria_label')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={closeModal}
    >
      <div
        className="bg-background max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="mb-4 text-xl font-semibold">{t('title')}</h2>
          <p className="text-muted-foreground mb-6 text-sm">{t('description')}</p>

          <Category
            name="necessary"
            title={t('necessary.title')}
            description={t('necessary.description')}
            checked={true}
            disabled={true}
            onChange={() => {}}
          />
          <Category
            name="analytics"
            title={t('analytics.title')}
            description={t('analytics.description')}
            checked={pending.analytics}
            onChange={(c) => setPending({ ...pending, analytics: c })}
          />
          <Category
            name="marketing"
            title={t('marketing.title')}
            description={t('marketing.description')}
            checked={pending.marketing}
            onChange={(c) => setPending({ ...pending, marketing: c })}
          />

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="ghost"
              onClick={closeModal}
              data-testid="modal-cancel"
              className="sm:order-1"
            >
              {t('cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setChoices(DEFAULT_DENY)}
              data-testid="modal-deny-all"
              className="sm:order-2"
            >
              {t('only_necessary')}
            </Button>
            <Button
              onClick={() => setChoices(pending)}
              data-testid="modal-save"
              className="sm:order-3 sm:ml-auto"
            >
              {t('save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CategoryProps {
  name: 'necessary' | 'analytics' | 'marketing';
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

function Category({ name, title, description, checked, disabled, onChange }: CategoryProps) {
  return (
    <div className="border-border border-t py-4" data-testid={`category-${name}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-medium">{title}</h3>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="border-border h-4 w-4 cursor-pointer rounded disabled:cursor-not-allowed disabled:opacity-50"
          data-testid={`toggle-${name}`}
          aria-label={title}
        />
      </div>
    </div>
  );
}
