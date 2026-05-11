import { auditLogsRepo } from '@/lib/data';

/**
 * Email-stub service (step 48). MVP keeps real SMTP out of scope
 * — every call:
 *
 *  1. Logs the message to stdout (dev visibility).
 *  2. Writes an `email_queued` audit-log entry when `tenantId` is
 *     supplied, so the audit trail shows what we'd have sent.
 *
 * Step 21 swaps this for the real provider integration; the public
 * interface stays the same so call sites don't change.
 */
export interface EmailStubInput {
  to: string;
  subject: string;
  body: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailStubResult {
  queued: true;
  id: string;
}

export async function queueEmail(input: EmailStubInput): Promise<EmailStubResult> {
  const id = `mock-email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Dev visibility — the real provider would log here too.
  // eslint-disable-next-line no-console
  console.log('[email-stub]', JSON.stringify({ id, to: input.to, subject: input.subject }));

  if (input.tenantId) {
    await auditLogsRepo.create({
      tenant_id: input.tenantId,
      action: 'email_queued',
      // System action — no user "performed" this; the email helpers
      // run on behalf of the platform.
      performed_by_user_id: null,
      metadata: {
        emailId: id,
        to: input.to,
        subject: input.subject,
        ...input.metadata,
      },
    });
  }

  return { queued: true, id };
}
