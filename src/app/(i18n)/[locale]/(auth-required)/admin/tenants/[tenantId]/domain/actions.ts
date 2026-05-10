'use server';

import { revalidatePath } from 'next/cache';

import { isUserSuperAdmin, requireCurrentUser } from '@/lib/auth';
import {
  type DomainSetupResult,
  removeDomainSetup as removeDomainSetupCore,
  startDomainSetup as startDomainSetupCore,
  verifyDomainSetup as verifyDomainSetupCore,
} from '@/lib/domain';

/**
 * Super-admin–only server actions for the domain wizard
 * (step 33). The orchestrators do the heavy lifting; this file
 * just gates on the super-admin id and revalidates the wizard
 * page after a successful mutation.
 */
async function assertSuperAdmin(): Promise<DomainSetupResult | { ok: true; userId: string }> {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return { success: false, error: 'Niet ingelogd' };
  }
  if (!isUserSuperAdmin(user.id)) {
    return { success: false, error: 'Alleen de super-admin mag domeinen koppelen' };
  }
  return { ok: true, userId: user.id };
}

export async function submitDomainSetupAction(
  tenantId: string,
  domain: string
): Promise<DomainSetupResult> {
  const guard = await assertSuperAdmin();
  if ('success' in guard) return guard;

  const result = await startDomainSetupCore({
    tenantId,
    domain,
    performedByUserId: guard.userId,
  });
  if (result.success) {
    revalidatePath(`/admin/tenants/${tenantId}/domain`);
  }
  return result;
}

export async function checkDomainVerificationAction(
  tenantId: string,
  domain: string
): Promise<DomainSetupResult> {
  const guard = await assertSuperAdmin();
  if ('success' in guard) return guard;

  const result = await verifyDomainSetupCore({ tenantId, domain });
  if (result.success) {
    revalidatePath(`/admin/tenants/${tenantId}/domain`);
  }
  return result;
}

export async function removeDomainSetupAction(
  tenantId: string,
  domain: string
): Promise<DomainSetupResult> {
  const guard = await assertSuperAdmin();
  if ('success' in guard) return guard;

  const result = await removeDomainSetupCore({ tenantId, domain });
  if (result.success) {
    revalidatePath(`/admin/tenants/${tenantId}/domain`);
  }
  return result;
}
