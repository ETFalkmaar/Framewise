import { tenantsRepo, usersRepo } from '@/lib/data';
import type { Tenant, TenantUser, User } from '@/types/database';
import { table } from '@/lib/data/adapters/mock/store';
import { NotAuthenticatedError } from './errors';
import { getSession } from './session';

const SUPER_ADMIN_USER_ID = 'a0000000-0000-0000-0000-000000000001';

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) return null;
  return usersRepo.findById(session.userId);
}

export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new NotAuthenticatedError();
  return user;
}

export async function getCurrentUserWithTenants(): Promise<{
  user: User;
  tenants: Tenant[];
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  // Tenant-membership lookup via the junction table. Once Supabase lands
  // (step 119) this becomes a single SQL join — the call signature stays.
  const memberships = Array.from(table('tenant_users').values()).filter(
    (m: TenantUser) => m.user_id === user.id
  );
  const tenants = (
    await Promise.all(memberships.map((m) => tenantsRepo.findById(m.tenant_id)))
  ).filter((t): t is Tenant => t !== null);

  return { user, tenants };
}

export async function getActiveTenantForUser(): Promise<Tenant | null> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) return null;

  if (session.activeTenantId) {
    return tenantsRepo.findById(session.activeTenantId);
  }

  const ctx = await getCurrentUserWithTenants();
  return ctx?.tenants[0] ?? null;
}

export function isUserSuperAdmin(userId: string): boolean {
  return userId === SUPER_ADMIN_USER_ID;
}

export const SUPER_ADMIN_ID = SUPER_ADMIN_USER_ID;
