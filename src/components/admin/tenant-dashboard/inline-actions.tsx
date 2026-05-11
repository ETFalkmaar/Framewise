'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TenantStatus } from '@/types/database';

import {
  publishSiteAction,
  unpublishSiteAction,
} from '@/app/(i18n)/[locale]/(auth-required)/account/setup/actions';

interface InlineActionsCopy {
  title: string;
  publishCta: string;
  unpublishCta: string;
  publishing: string;
  unpublishing: string;
  blockedHint: string;
  liveLabel: string;
  cancelledLabel: string;
  confirmUnpublish: string;
}

export interface InlineActionsProps {
  tenantStatus: TenantStatus;
  canPublish: boolean;
  copy: InlineActionsCopy;
}

/**
 * Client island on the per-tenant dashboard (step 36) that pulls
 * the publish / unpublish triggers right onto the page so the
 * super-admin never has to switch routes. Defers to the step 32
 * server actions; the page re-renders on success via
 * `revalidatePath`.
 *
 * For `cancelled` tenants we render a read-only banner — once a
 * tenant is terminal there's no recovery action here.
 */
export function InlineActions({ tenantStatus, canPublish, copy }: InlineActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (tenantStatus === 'cancelled') {
    return (
      <Card
        data-testid="inline-actions-cancelled"
        className="border-destructive/40 bg-destructive/5"
      >
        <CardHeader>
          <CardTitle className="text-sm">{copy.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-destructive text-xs">{copy.cancelledLabel}</CardContent>
      </Card>
    );
  }

  if (tenantStatus === 'live') {
    return (
      <Card data-testid="inline-actions-live" className="border-emerald-500/40 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="text-sm text-emerald-700 dark:text-emerald-300">
            {copy.title}
          </CardTitle>
          <CardDescription className="text-xs">{copy.liveLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!confirm(copy.confirmUnpublish)) return;
              setError(null);
              startTransition(async () => {
                const result = await unpublishSiteAction('admin-dashboard');
                if (!result.success) setError(result.error ?? 'Onbekende fout');
              });
            }}
            disabled={pending}
            data-testid="inline-unpublish"
          >
            {pending ? copy.unpublishing : copy.unpublishCta}
          </Button>
          {error && (
            <p data-testid="inline-action-error" className="text-destructive text-xs">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // onboarding | paused
  return (
    <Card data-testid="inline-actions-maintenance">
      <CardHeader>
        <CardTitle className="text-sm">{copy.title}</CardTitle>
        <CardDescription className="text-xs">{canPublish ? '' : copy.blockedHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          type="button"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await publishSiteAction();
              if (!result.success) setError(result.error ?? 'Onbekende fout');
            });
          }}
          disabled={!canPublish || pending}
          data-testid="inline-publish"
        >
          {pending ? copy.publishing : copy.publishCta}
        </Button>
        {error && (
          <p data-testid="inline-action-error" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
