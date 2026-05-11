'use client';

import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  approvePublishRequest,
  rejectPublishRequest,
} from '@/app/(i18n)/[locale]/(auth-required)/admin/tenants/[tenantId]/publish-actions';
import type { Tenant, User } from '@/types/database';

export interface PublishRequestCardCopy {
  cardTitle: string;
  requestedBy: string;
  requestedAt: string;
  previewSite: string;
  approveButton: string;
  approveModalTitle: string;
  approveModalBody: string;
  approveNotesLabel: string;
  approveSubmit: string;
  rejectButton: string;
  rejectModalTitle: string;
  rejectModalBody: string;
  rejectNotesLabel: string;
  rejectNotesPlaceholder: string;
  rejectNotesHint: string;
  rejectNotesShort: string;
  rejectSubmit: string;
  cancel: string;
  errorGeneric: string;
}

export interface PublishRequestCardProps {
  tenant: Tenant;
  requestedBy: User | null;
  previewUrl: string;
  copy: PublishRequestCardCopy;
}

const REJECT_NOTES_MIN_CHARS = 10;

/**
 * Super-admin "approve / reject" surface (step 47). Renders only
 * when the tenant has a pending request. Two modals: the approve
 * one with an optional internal-notes field, and the reject one
 * with a required ≥10-char rationale that gets surfaced to the
 * customer's rejected-banner on /account.
 *
 * The modals overlay the dashboard via fixed positioning so the
 * super-admin can scan the rest of the tenant context while the
 * dialog is open.
 */
export function PublishRequestCard({
  tenant,
  requestedBy,
  previewUrl,
  copy,
}: PublishRequestCardProps): React.ReactElement | null {
  const [pending, startTransition] = useTransition();
  const [openModal, setOpenModal] = useState<null | 'approve' | 'reject'>(null);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');

  if (tenant.publish_request_status !== 'pending') return null;

  function submitApprove(): void {
    startTransition(async () => {
      const result = await approvePublishRequest({
        tenantId: tenant.id,
        notes: approveNotes.trim() || undefined,
      });
      if (!result.success) {
        window.alert(copy.errorGeneric);
        return;
      }
      setOpenModal(null);
      setApproveNotes('');
    });
  }

  function submitReject(): void {
    const trimmed = rejectNotes.trim();
    if (trimmed.length < REJECT_NOTES_MIN_CHARS) return;
    startTransition(async () => {
      const result = await rejectPublishRequest({
        tenantId: tenant.id,
        notes: trimmed,
      });
      if (!result.success) {
        window.alert(copy.errorGeneric);
        return;
      }
      setOpenModal(null);
      setRejectNotes('');
    });
  }

  const requesterName = requestedBy?.name ?? '—';
  const requestedAtIso = tenant.publish_requested_at ?? '';

  return (
    <>
      <div
        data-testid="admin-publish-request"
        className="border-amber-500/40 bg-amber-500/10 mb-6 flex flex-col gap-3 rounded-md border p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-amber-500/40 font-mono">
            pending
          </Badge>
          <h3 className="text-sm font-semibold">{copy.cardTitle}</h3>
        </div>
        <p className="text-muted-foreground text-xs">
          {copy.requestedBy.replace('{user}', requesterName)} ·{' '}
          {copy.requestedAt.replace('{date}', formatIsoCompact(requestedAtIso))}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="admin-publish-preview-link"
            className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition"
          >
            {copy.previewSite}
          </a>
          <button
            type="button"
            data-testid="approve-publish"
            onClick={() => setOpenModal('approve')}
            disabled={pending}
            className="bg-emerald-600 hover:bg-emerald-700 rounded-md px-3 py-1.5 font-mono text-xs text-white transition disabled:opacity-50"
          >
            {copy.approveButton}
          </button>
          <button
            type="button"
            data-testid="reject-publish"
            onClick={() => setOpenModal('reject')}
            disabled={pending}
            className="ring-destructive/40 text-destructive hover:bg-destructive/10 rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition disabled:opacity-50"
          >
            {copy.rejectButton}
          </button>
        </div>
      </div>

      {openModal === 'approve' && (
        <ApproveModal
          notes={approveNotes}
          setNotes={setApproveNotes}
          onCancel={() => setOpenModal(null)}
          onSubmit={submitApprove}
          pending={pending}
          copy={copy}
        />
      )}

      {openModal === 'reject' && (
        <RejectModal
          notes={rejectNotes}
          setNotes={setRejectNotes}
          onCancel={() => setOpenModal(null)}
          onSubmit={submitReject}
          pending={pending}
          copy={copy}
        />
      )}
    </>
  );
}

function ApproveModal({
  notes,
  setNotes,
  onCancel,
  onSubmit,
  pending,
  copy,
}: {
  notes: string;
  setNotes: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  pending: boolean;
  copy: PublishRequestCardCopy;
}) {
  return (
    <div
      data-testid="approve-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-background border-border w-full max-w-lg rounded-lg border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{copy.approveModalTitle}</h2>
        <p className="text-muted-foreground mt-2 mb-4 text-sm">{copy.approveModalBody}</p>
        <label className="block">
          <span className="text-muted-foreground text-xs">{copy.approveNotesLabel}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            data-testid="approve-notes-input"
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 text-sm ring-1"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            data-testid="approve-submit"
            onClick={onSubmit}
            disabled={pending}
            className="bg-emerald-600 hover:bg-emerald-700 rounded-md px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {copy.approveSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({
  notes,
  setNotes,
  onCancel,
  onSubmit,
  pending,
  copy,
}: {
  notes: string;
  setNotes: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  pending: boolean;
  copy: PublishRequestCardCopy;
}) {
  const trimmed = notes.trim();
  const tooShort = trimmed.length < REJECT_NOTES_MIN_CHARS;
  return (
    <div
      data-testid="reject-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-background border-border w-full max-w-lg rounded-lg border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{copy.rejectModalTitle}</h2>
        <p className="text-muted-foreground mt-2 mb-4 text-sm">{copy.rejectModalBody}</p>
        <label className="block">
          <span className="text-muted-foreground text-xs">{copy.rejectNotesLabel}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder={copy.rejectNotesPlaceholder}
            data-testid="reject-notes-input"
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
          <span
            className={`mt-1 block font-mono text-[10px] ${
              tooShort ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {tooShort ? copy.rejectNotesShort : copy.rejectNotesHint}
          </span>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 text-sm ring-1"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            data-testid="reject-submit"
            onClick={onSubmit}
            disabled={pending || tooShort}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {copy.rejectSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatIsoCompact(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
