'use server';

import { revalidatePath } from 'next/cache';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import {
  softDeleteMediaFor,
  uploadMediaFor,
  type MediaDeleteErrorCode,
  type MediaUploadErrorCode,
} from '@/lib/media/library';
import type { Media } from '@/types/database';

export interface UploadMediaResult {
  success: boolean;
  media?: Media;
  errorCode?: MediaUploadErrorCode | 'unauthenticated' | 'no_active_tenant';
  error?: string;
}

const UPLOAD_MESSAGES: Record<NonNullable<UploadMediaResult['errorCode']>, string> = {
  unauthenticated: 'Niet ingelogd',
  no_active_tenant: 'Geen actieve tenant',
  tenant_not_found: 'Tenant niet gevonden',
  forbidden: 'Geen rechten om media te uploaden',
  file_too_large: 'Bestand te groot (max 50 MB)',
  invalid_type: 'Alleen afbeeldingen toegestaan (JPG / PNG / WebP / GIF)',
  empty_file: 'Leeg bestand kan niet geüpload worden',
  invalid_filename: 'Ongeldige bestandsnaam',
  upload_failed: 'Upload mislukt',
};

/**
 * Server-action wrapper around the customer-facing media upload
 * (step 42, fase 12 part 4/8). Browser → FormData → here. We
 * decode the `File`, hand the raw bytes to the pure
 * `uploadMediaFor` use case (which gates on Pro / Enterprise
 * plan + role, validates size/mime, then routes through the
 * storage adapter).
 */
export async function uploadMediaAction(formData: FormData): Promise<UploadMediaResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, errorCode: 'unauthenticated', error: UPLOAD_MESSAGES.unauthenticated };
  }

  const tenant = await getActiveTenantForUser();
  if (!tenant) {
    return {
      success: false,
      errorCode: 'no_active_tenant',
      error: UPLOAD_MESSAGES.no_active_tenant,
    };
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return {
      success: false,
      errorCode: 'invalid_filename',
      error: UPLOAD_MESSAGES.invalid_filename,
    };
  }

  const buffer = new Uint8Array(await file.arrayBuffer());

  const outcome = await uploadMediaFor({
    userId: user.id,
    tenantId: tenant.id,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: buffer.byteLength,
    body: buffer,
  });

  if (!outcome.success) {
    return {
      success: false,
      errorCode: outcome.errorCode,
      error: outcome.errorCode ? UPLOAD_MESSAGES[outcome.errorCode] : 'Onbekende fout',
    };
  }

  revalidatePath('/account/site/media');
  return { success: true, media: outcome.media };
}

export interface DeleteMediaResult {
  success: boolean;
  errorCode?: MediaDeleteErrorCode | 'unauthenticated' | 'no_active_tenant';
  error?: string;
}

const DELETE_MESSAGES: Record<NonNullable<DeleteMediaResult['errorCode']>, string> = {
  unauthenticated: 'Niet ingelogd',
  no_active_tenant: 'Geen actieve tenant',
  media_not_found: 'Media niet gevonden',
  tenant_mismatch: 'Media hoort niet bij deze tenant',
  forbidden: 'Geen rechten om media te verwijderen',
};

/**
 * Soft-delete a media item (step 42). The storage object stays
 * — only `Media.deleted_at` flips. That way customers don't
 * accidentally break image blocks that still reference the URL.
 */
export async function deleteMediaAction(mediaId: string): Promise<DeleteMediaResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, errorCode: 'unauthenticated', error: DELETE_MESSAGES.unauthenticated };
  }

  const tenant = await getActiveTenantForUser();
  if (!tenant) {
    return {
      success: false,
      errorCode: 'no_active_tenant',
      error: DELETE_MESSAGES.no_active_tenant,
    };
  }

  const outcome = await softDeleteMediaFor({
    userId: user.id,
    tenantId: tenant.id,
    mediaId,
  });

  if (!outcome.success) {
    return {
      success: false,
      errorCode: outcome.errorCode,
      error: outcome.errorCode ? DELETE_MESSAGES[outcome.errorCode] : 'Onbekende fout',
    };
  }

  revalidatePath('/account/site/media');
  return { success: true };
}
