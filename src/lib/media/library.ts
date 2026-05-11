import { mediaRepo, subscriptionsRepo, tenantsRepo } from '@/lib/data';
import { canEditBlocks } from '@/lib/permissions';
import {
  STORAGE_ERROR_CODES,
  StorageError,
  uploadMedia as storageUploadMedia,
} from '@/lib/storage';
import type { Media } from '@/types/database';

/**
 * Pure (testable) use cases behind the customer-facing media
 * library (step 42, fase 12 part 4/8). The server actions in
 * `/account/site/media/actions.ts` are thin shells that resolve
 * the iron-session user + active tenant via `next/headers` and
 * delegate here.
 *
 * Why a wrapper around `@/lib/storage` `uploadMedia`?
 *  - Permission gate (`canEditBlocks` — Pro / Enterprise + role,
 *    super-admin bypass). The storage layer is plan-agnostic.
 *  - Translates `StorageError` to short stable error codes so
 *    the UI maps them to localised strings.
 *  - Owns the `softDelete` flow that pairs with the `Media.
 *    deleted_at` column added in step 42 — hard delete stays
 *    available for tests + admin cleanup.
 */
export type MediaUploadErrorCode =
  | 'tenant_not_found'
  | 'forbidden'
  | 'file_too_large'
  | 'invalid_type'
  | 'empty_file'
  | 'invalid_filename'
  | 'upload_failed';

export type MediaDeleteErrorCode = 'media_not_found' | 'forbidden' | 'tenant_mismatch';

export interface UploadMediaForInput {
  userId: string;
  tenantId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  body: ArrayBuffer | Uint8Array | Buffer;
  altText?: Partial<Record<'nl' | 'fr' | 'en', string>>;
  width?: number | null;
  height?: number | null;
  now?: Date;
}

export interface UploadMediaForOutcome {
  success: boolean;
  media?: Media;
  errorCode?: MediaUploadErrorCode;
  errorDetail?: string;
}

export async function uploadMediaFor(input: UploadMediaForInput): Promise<UploadMediaForOutcome> {
  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return { success: false, errorCode: 'tenant_not_found' };

  const subscription = await subscriptionsRepo.findByTenant(tenant.id);
  const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;
  const allowed = await canEditBlocks(input.userId, tenant, plan?.code ?? null);
  if (!allowed) return { success: false, errorCode: 'forbidden' };

  try {
    const result = await storageUploadMedia({
      tenantId: tenant.id,
      uploadedByUserId: input.userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      body: input.body,
      altText: input.altText,
      width: input.width,
      height: input.height,
      now: input.now,
    });
    return { success: true, media: result.media };
  } catch (err) {
    if (err instanceof StorageError) {
      return {
        success: false,
        errorCode: mapStorageError(err.code),
        errorDetail: err.message,
      };
    }
    return {
      success: false,
      errorCode: 'upload_failed',
      errorDetail: err instanceof Error ? err.message : String(err),
    };
  }
}

function mapStorageError(code: string): MediaUploadErrorCode {
  switch (code) {
    case STORAGE_ERROR_CODES.FILE_TOO_LARGE:
      return 'file_too_large';
    case STORAGE_ERROR_CODES.INVALID_MIME_TYPE:
      return 'invalid_type';
    case STORAGE_ERROR_CODES.INVALID_PATH:
      return 'invalid_filename';
    default:
      return 'upload_failed';
  }
}

export interface SoftDeleteMediaForInput {
  userId: string;
  tenantId: string;
  mediaId: string;
}

export interface SoftDeleteMediaForOutcome {
  success: boolean;
  errorCode?: MediaDeleteErrorCode;
}

export async function softDeleteMediaFor(
  input: SoftDeleteMediaForInput
): Promise<SoftDeleteMediaForOutcome> {
  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return { success: false, errorCode: 'media_not_found' };

  const subscription = await subscriptionsRepo.findByTenant(tenant.id);
  const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;
  const allowed = await canEditBlocks(input.userId, tenant, plan?.code ?? null);
  if (!allowed) return { success: false, errorCode: 'forbidden' };

  const media = await mediaRepo.findById(input.mediaId);
  if (!media) return { success: false, errorCode: 'media_not_found' };
  if (media.tenant_id !== tenant.id) return { success: false, errorCode: 'tenant_mismatch' };
  if (media.deleted_at !== null) return { success: true };

  await mediaRepo.softDelete(input.mediaId);
  return { success: true };
}
