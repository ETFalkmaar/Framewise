import { table } from '@/lib/data/adapters/mock/store';
import type { Role, TenantUser } from '@/types/database';

/**
 * Resolve the user id of the tenant's owner — the recipient of
 * approval / rejection notifications in step 48.
 *
 * If a tenant has multiple owners (rare today; supported by the
 * schema), the lowest-id one wins. Returns `null` when the tenant
 * has no owner membership at all — shouldn't happen in seeded
 * data but the caller handles it gracefully.
 *
 * Lives in `auth/` because it reads `tenant_users` + `roles` —
 * same data the rest of the auth helpers consult.
 */
export async function findTenantOwnerUserId(tenantId: string): Promise<string | null> {
  // Collect ownerships for this tenant, then sort by id for
  // deterministic single-owner pick.
  const memberships = Array.from(table('tenant_users').values()).filter(
    (m: TenantUser) => m.tenant_id === tenantId
  );

  const ownerMemberships: TenantUser[] = [];
  for (const m of memberships) {
    const role = table('roles').get(m.role_id) as Role | undefined;
    if (role?.name === 'owner') ownerMemberships.push(m);
  }
  if (ownerMemberships.length === 0) return null;

  ownerMemberships.sort((a, b) => a.id.localeCompare(b.id));
  return ownerMemberships[0].user_id;
}
