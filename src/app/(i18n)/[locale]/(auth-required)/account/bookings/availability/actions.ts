'use server';

import { revalidatePath } from 'next/cache';

import { getActiveTenantForUser, requireCurrentUser } from '@/lib/auth';
import {
  auditLogsRepo,
  availabilityRulesRepo,
  bookingExceptionsRepo,
  tenantsRepo,
} from '@/lib/data';
import { canManageBookings } from '@/lib/permissions/bookings';
import type { AvailabilityRule, DayOfWeek } from '@/types/database';

export type AvailabilityActionErrorCode =
  | 'unauthenticated'
  | 'no_active_tenant'
  | 'tenant_not_found'
  | 'forbidden'
  | 'invalid_input'
  | 'rule_not_found'
  | 'exception_not_found'
  | 'tenant_mismatch'
  | 'repo_error';

export interface AvailabilityActionResult {
  success: boolean;
  error?: AvailabilityActionErrorCode;
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function authedTenantContext() {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { error: 'unauthenticated' as const };
  }
  const tenant = await getActiveTenantForUser();
  if (!tenant) return { error: 'no_active_tenant' as const };
  const fresh = await tenantsRepo.findById(tenant.id);
  if (!fresh) return { error: 'tenant_not_found' as const };
  const allowed = await canManageBookings(user.id, fresh);
  if (!allowed) return { error: 'forbidden' as const };
  return { user, tenant: fresh };
}

function validateRule(input: {
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  max_party_size: number;
  max_concurrent_bookings: number;
  buffer_minutes: number;
}): AvailabilityActionErrorCode | null {
  if (!input.name?.trim()) return 'invalid_input';
  if (![0, 1, 2, 3, 4, 5, 6].includes(input.day_of_week)) return 'invalid_input';
  if (!HHMM_RE.test(input.start_time) || !HHMM_RE.test(input.end_time)) return 'invalid_input';
  if (input.start_time >= input.end_time) return 'invalid_input';
  if (input.slot_duration_minutes < 15) return 'invalid_input';
  if (input.max_party_size < 1) return 'invalid_input';
  if (input.max_concurrent_bookings < 1) return 'invalid_input';
  if (input.buffer_minutes < 0) return 'invalid_input';
  return null;
}

export interface CreateAvailabilityRuleInput {
  name: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  max_party_size: number;
  max_concurrent_bookings: number;
  buffer_minutes?: number;
  effective_from?: string | null;
  effective_until?: string | null;
  is_active?: boolean;
}

export async function createAvailabilityRule(
  input: CreateAvailabilityRuleInput
): Promise<AvailabilityActionResult> {
  const ctx = await authedTenantContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  const bufferMinutes = input.buffer_minutes ?? 0;
  const validationError = validateRule({ ...input, buffer_minutes: bufferMinutes });
  if (validationError) return { success: false, error: validationError };

  try {
    const rule = await availabilityRulesRepo.create({
      tenant_id: ctx.tenant.id,
      name: input.name.trim(),
      is_active: input.is_active ?? true,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      slot_duration_minutes: input.slot_duration_minutes,
      max_party_size: input.max_party_size,
      max_concurrent_bookings: input.max_concurrent_bookings,
      buffer_minutes: bufferMinutes,
      effective_from: input.effective_from ?? null,
      effective_until: input.effective_until ?? null,
    });
    await auditLogsRepo.create({
      tenant_id: ctx.tenant.id,
      action: 'availability_rule_created',
      performed_by_user_id: ctx.user.id,
      metadata: { ruleId: rule.id, name: rule.name, dayOfWeek: rule.day_of_week },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }

  revalidatePath('/account/bookings/availability');
  return { success: true };
}

export async function updateAvailabilityRule(input: {
  ruleId: string;
  patch: Partial<
    Pick<
      AvailabilityRule,
      | 'name'
      | 'is_active'
      | 'day_of_week'
      | 'start_time'
      | 'end_time'
      | 'slot_duration_minutes'
      | 'max_party_size'
      | 'max_concurrent_bookings'
      | 'buffer_minutes'
      | 'effective_from'
      | 'effective_until'
    >
  >;
}): Promise<AvailabilityActionResult> {
  const ctx = await authedTenantContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  const rule = await availabilityRulesRepo.findById(input.ruleId);
  if (!rule) return { success: false, error: 'rule_not_found' };
  if (rule.tenant_id !== ctx.tenant.id) return { success: false, error: 'tenant_mismatch' };

  // If the patch touches the window, validate the merged result.
  if (
    input.patch.start_time !== undefined ||
    input.patch.end_time !== undefined ||
    input.patch.slot_duration_minutes !== undefined
  ) {
    const merged = {
      name: input.patch.name ?? rule.name,
      day_of_week: input.patch.day_of_week ?? rule.day_of_week,
      start_time: input.patch.start_time ?? rule.start_time,
      end_time: input.patch.end_time ?? rule.end_time,
      slot_duration_minutes: input.patch.slot_duration_minutes ?? rule.slot_duration_minutes,
      max_party_size: input.patch.max_party_size ?? rule.max_party_size,
      max_concurrent_bookings:
        input.patch.max_concurrent_bookings ?? rule.max_concurrent_bookings,
      buffer_minutes: input.patch.buffer_minutes ?? rule.buffer_minutes,
    };
    const err = validateRule(merged);
    if (err) return { success: false, error: err };
  }

  try {
    await availabilityRulesRepo.update(input.ruleId, input.patch);
    await auditLogsRepo.create({
      tenant_id: ctx.tenant.id,
      action: 'availability_rule_updated',
      performed_by_user_id: ctx.user.id,
      metadata: { ruleId: input.ruleId, patch: input.patch },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }

  revalidatePath('/account/bookings/availability');
  return { success: true };
}

export async function deleteAvailabilityRule(input: {
  ruleId: string;
}): Promise<AvailabilityActionResult> {
  const ctx = await authedTenantContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  const rule = await availabilityRulesRepo.findById(input.ruleId);
  if (!rule) return { success: false, error: 'rule_not_found' };
  if (rule.tenant_id !== ctx.tenant.id) return { success: false, error: 'tenant_mismatch' };

  try {
    await availabilityRulesRepo.delete(input.ruleId);
    await auditLogsRepo.create({
      tenant_id: ctx.tenant.id,
      action: 'availability_rule_deleted',
      performed_by_user_id: ctx.user.id,
      metadata: { ruleId: input.ruleId, name: rule.name, dayOfWeek: rule.day_of_week },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }

  revalidatePath('/account/bookings/availability');
  return { success: true };
}

export async function toggleAvailabilityRule(input: {
  ruleId: string;
}): Promise<AvailabilityActionResult> {
  const ctx = await authedTenantContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  const rule = await availabilityRulesRepo.findById(input.ruleId);
  if (!rule) return { success: false, error: 'rule_not_found' };
  if (rule.tenant_id !== ctx.tenant.id) return { success: false, error: 'tenant_mismatch' };

  try {
    await availabilityRulesRepo.update(input.ruleId, { is_active: !rule.is_active });
    await auditLogsRepo.create({
      tenant_id: ctx.tenant.id,
      action: 'availability_rule_toggled',
      performed_by_user_id: ctx.user.id,
      metadata: { ruleId: input.ruleId, newState: !rule.is_active },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }

  revalidatePath('/account/bookings/availability');
  return { success: true };
}

export interface CreateBookingExceptionInput {
  date: string;
  reason: string;
  is_closed: boolean;
  custom_start_time?: string | null;
  custom_end_time?: string | null;
}

export async function createBookingException(
  input: CreateBookingExceptionInput
): Promise<AvailabilityActionResult> {
  const ctx = await authedTenantContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  if (!ISO_DATE_RE.test(input.date)) return { success: false, error: 'invalid_input' };
  if (!input.reason?.trim()) return { success: false, error: 'invalid_input' };
  if (!input.is_closed) {
    // Custom-times path requires both times in HH:mm format with start < end.
    if (!input.custom_start_time || !input.custom_end_time) {
      return { success: false, error: 'invalid_input' };
    }
    if (
      !HHMM_RE.test(input.custom_start_time) ||
      !HHMM_RE.test(input.custom_end_time) ||
      input.custom_start_time >= input.custom_end_time
    ) {
      return { success: false, error: 'invalid_input' };
    }
  }

  try {
    const exception = await bookingExceptionsRepo.create({
      tenant_id: ctx.tenant.id,
      date: input.date,
      reason: input.reason.trim(),
      is_closed: input.is_closed,
      custom_start_time: input.is_closed ? null : input.custom_start_time ?? null,
      custom_end_time: input.is_closed ? null : input.custom_end_time ?? null,
    });
    await auditLogsRepo.create({
      tenant_id: ctx.tenant.id,
      action: 'booking_exception_created',
      performed_by_user_id: ctx.user.id,
      metadata: {
        exceptionId: exception.id,
        date: input.date,
        isClosed: input.is_closed,
      },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }

  revalidatePath('/account/bookings/availability');
  return { success: true };
}

export async function deleteBookingException(input: {
  exceptionId: string;
}): Promise<AvailabilityActionResult> {
  const ctx = await authedTenantContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  const exception = await bookingExceptionsRepo.findById(input.exceptionId);
  if (!exception) return { success: false, error: 'exception_not_found' };
  if (exception.tenant_id !== ctx.tenant.id) return { success: false, error: 'tenant_mismatch' };

  try {
    await bookingExceptionsRepo.delete(input.exceptionId);
    await auditLogsRepo.create({
      tenant_id: ctx.tenant.id,
      action: 'booking_exception_deleted',
      performed_by_user_id: ctx.user.id,
      metadata: { exceptionId: input.exceptionId, date: exception.date },
    });
  } catch {
    return { success: false, error: 'repo_error' };
  }

  revalidatePath('/account/bookings/availability');
  return { success: true };
}
