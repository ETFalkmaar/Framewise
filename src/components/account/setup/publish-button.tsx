'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import {
  publishSiteAction,
  unpublishSiteAction,
} from '@/app/(i18n)/[locale]/(auth-required)/account/setup/actions';

interface PublishButtonCopy {
  publishTitle: string;
  liveTitle: string;
  publishHint: string;
  liveHint: string;
  publishCta: string;
  unpublishCta: string;
  publishing: string;
  unpublishing: string;
  blockedHint: string;
  liveStatusLabel: string;
}

export interface PublishButtonProps {
  /** Live = render the "site is live" + unpublish UI. */
  currentStatus: 'live' | 'maintenance';
  /** From `canTenantGoLive` — disables the publish button when false. */
  canPublish: boolean;
  copy: PublishButtonCopy;
}

/**
 * Super-admin–only client island on the setup page (step 32).
 * Renders one of two states:
 *  - `currentStatus === 'maintenance'`: a primary publish CTA. The
 *    button is disabled unless `canPublish` is true (the upstream
 *    `canTenantGoLive` gate); a small hint explains what's still
 *    missing.
 *  - `currentStatus === 'live'`: a confirmation card with a
 *    secondary "in onderhoud zetten" button so the admin can pull
 *    the site offline for an emergency repair.
 *
 * Errors from the server action are surfaced inline; success
 * triggers a `revalidatePath` server-side so the page re-renders
 * with the new status.
 */
export function PublishButton({ currentStatus, canPublish, copy }: PublishButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handlePublish = () => {
    setError(null);
    startTransition(async () => {
      const result = await publishSiteAction();
      if (!result.success) {
        setError(result.error ?? 'Onbekende fout');
      }
    });
  };

  const handleUnpublish = () => {
    setError(null);
    startTransition(async () => {
      const result = await unpublishSiteAction();
      if (!result.success) {
        setError(result.error ?? 'Onbekende fout');
      }
    });
  };

  if (currentStatus === 'live') {
    return (
      <Card
        size="sm"
        data-testid="publish-card-live"
        className="border-emerald-500/40 bg-emerald-500/5"
      >
        <CardHeader>
          <CardTitle className="text-sm text-emerald-700 dark:text-emerald-300">
            ✅ {copy.liveTitle}
          </CardTitle>
          <CardDescription className="text-xs">{copy.liveHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground font-mono text-xs">{copy.liveStatusLabel}</p>
          <Button
            type="button"
            variant="outline"
            onClick={handleUnpublish}
            disabled={pending}
            data-testid="btn-unpublish"
          >
            {pending ? copy.unpublishing : copy.unpublishCta}
          </Button>
          {error && (
            <p data-testid="publish-error" className="text-destructive text-xs">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm" data-testid="publish-card-maintenance">
      <CardHeader>
        <CardTitle className="text-sm">{copy.publishTitle}</CardTitle>
        <CardDescription className="text-xs">
          {canPublish ? copy.publishHint : copy.blockedHint}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          type="button"
          onClick={handlePublish}
          disabled={!canPublish || pending}
          data-testid="btn-publish"
        >
          {pending ? copy.publishing : copy.publishCta}
        </Button>
        {error && (
          <p data-testid="publish-error" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
