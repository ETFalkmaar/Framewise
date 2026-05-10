'use server';

import { isUserSuperAdmin, requireCurrentUser } from '@/lib/auth';
import { createTenant } from '@/lib/onboarding/create-tenant';
import type { OnboardingFormData, OnboardingResult } from '@/lib/onboarding/types';
import { onboardingSchema } from '@/lib/onboarding/validation';

/**
 * Server action invoked when the wizard's review step is submitted
 * (step 30). Re-validates the payload server-side, gates on the
 * super-admin id, and delegates to `createTenant()`. Errors are
 * returned as `{ success: false, error }` so the client can show
 * a toast without re-throwing across the boundary.
 */
export async function submitOnboardingAction(
  formData: OnboardingFormData
): Promise<OnboardingResult> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'Niet ingelogd' };
  }

  if (!isUserSuperAdmin(user.id)) {
    return { success: false, error: 'Alleen de super-admin mag tenants onboarden' };
  }

  const parsed = onboardingSchema.safeParse(formData);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.join('.') ?? '';
    return {
      success: false,
      error: `Validatie mislukt${path ? ` (${path})` : ''}: ${first?.message ?? 'onbekend'}`,
    };
  }

  return createTenant(parsed.data, user.id);
}
