'use client';

import { useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  cancelPublishRequest,
  requestSitePublish,
} from '@/app/(i18n)/[locale]/(auth-required)/account/publish-actions';
import type { Tenant } from '@/types/database';

export interface PublishStatusBannerCopy {
  /** Idle (draft) state: the customer can submit. */
  ctaTitle: string;
  ctaButton: string;
  confirmRequest: string;
  /** Pending state. */
  pendingLabel: string;
  pendingHint: string;
  cancelButton: string;
  confirmCancel: string;
  /** Approved + live state. */
  approvedLabel: string;
  viewSite: string;
  /** Rejected state. */
  rejectedLabel: string;
  rejectionNotesLabel: string;
  resubmitButton: string;
  /** Generic error fallback. */
  errorGeneric: string;
}

export interface PublishStatusBannerProps {
  tenant: Tenant;
  /** Public preview URL on the path-prefix renderer. */
  publicUrl: string;
  copy: PublishStatusBannerCopy;
}

/**
 * Customer-side publish-status surface (step 47, fase 13 part 1/2).
 *
 * Renders different "skins" depending on the tenant's
 * `publish_request_status` × `tenant.status` combination:
 *
 *  - `'none'` + non-live → "Site live zetten" CTA. window.confirm
 *    gate before the submit so the customer doesn't trigger by
 *    accident.
 *  - `'pending'` → amber waiting banner with a cancel button.
 *  - `'approved'` && `tenant.status === 'live'` → green celebration
 *    banner + link to the public site.
 *  - `'rejected'` → red banner with the rejection notes the
 *    super-admin left + a "resubmit" button (which fires
 *    `requestSitePublish` again; the action clears the rejection
 *    fields).
 *
 * No-op when the tenant is already live AND there's no pending /
 * rejected request — returns `null` so the account dashboard
 * doesn't show a banner for "everything's normal".
 */
export function PublishStatusBanner({
  tenant,
  publicUrl,
  copy,
}: PublishStatusBannerProps): React.ReactElement | null {
  const [pending, startTransition] = useTransition();

  function submitRequest(): void {
    if (!window.confirm(copy.confirmRequest)) return;
    startTransition(async () => {
      const result = await requestSitePublish();
      if (!result.success) window.alert(copy.errorGeneric);
    });
  }

  function submitCancel(): void {
    if (!window.confirm(copy.confirmCancel)) return;
    startTransition(async () => {
      const result = await cancelPublishRequest();
      if (!result.success) window.alert(copy.errorGeneric);
    });
  }

  // Approved + live: celebration banner.
  if (tenant.publish_request_status === 'approved' && tenant.status === 'live') {
    return (
      <div
        data-testid="publish-approved-banner"
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300"
      >
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            live
          </Badge>
          <span className="text-sm font-medium">{copy.approvedLabel}</span>
        </div>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="publish-view-live-link"
          className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition"
        >
          {copy.viewSite}
        </a>
      </div>
    );
  }

  // Pending.
  if (tenant.publish_request_status === 'pending') {
    return (
      <div
        data-testid="publish-pending-banner"
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">{copy.pendingLabel}</span>
          <span className="text-muted-foreground text-xs">{copy.pendingHint}</span>
        </div>
        <button
          type="button"
          data-testid="cancel-publish-request"
          onClick={submitCancel}
          disabled={pending}
          className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition disabled:opacity-50"
        >
          {copy.cancelButton}
        </button>
      </div>
    );
  }

  // Rejected.
  if (tenant.publish_request_status === 'rejected') {
    return (
      <div
        data-testid="publish-rejected-banner"
        className="border-destructive/40 bg-destructive/10 text-destructive mb-6 flex flex-col gap-2 rounded-md border p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium">{copy.rejectedLabel}</span>
          <button
            type="button"
            data-testid="publish-resubmit-button"
            onClick={submitRequest}
            disabled={pending}
            className="ring-border bg-background hover:bg-muted text-foreground rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition disabled:opacity-50"
          >
            {copy.resubmitButton}
          </button>
        </div>
        {tenant.publish_approval_notes && (
          <p className="text-foreground text-xs">
            <span className="text-muted-foreground font-mono">{copy.rejectionNotesLabel}:</span>{' '}
            {tenant.publish_approval_notes}
          </p>
        )}
      </div>
    );
  }

  // Idle (none) + not live yet: show the CTA.
  if (tenant.publish_request_status === 'none' && tenant.status !== 'live') {
    return (
      <div
        data-testid="publish-status-banner"
        className="border-border bg-muted/30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">{copy.ctaTitle}</span>
        </div>
        <button
          type="button"
          data-testid="publish-request-button"
          onClick={submitRequest}
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 font-mono text-xs transition disabled:opacity-50"
        >
          {copy.ctaButton}
        </button>
      </div>
    );
  }

  // Live + nothing pending → nothing to show.
  return null;
}
