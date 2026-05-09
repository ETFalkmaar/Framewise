import { table } from '@/lib/data/adapters/mock/store';
import type { Role, RoleName, TenantUser } from '@/types/database';
import { ForbiddenError } from './errors';
import { isUserSuperAdmin } from './current-user';

async function getMembership(
  userId: string,
  tenantId: string
): Promise<{ membership: TenantUser; role: Role } | null> {
  const membership = Array.from(table('tenant_users').values()).find(
    (m: TenantUser) => m.user_id === userId && m.tenant_id === tenantId
  );
  if (!membership) return null;

  const role = table('roles').get(membership.role_id);
  if (!role) return null;
  return { membership, role };
}

async function hasRole(userId: string, tenantId: string, allowed: RoleName[]): Promise<boolean> {
  if (isUserSuperAdmin(userId)) return true;
  const ctx = await getMembership(userId, tenantId);
  if (!ctx) return false;
  return allowed.includes(ctx.role.name);
}

export async function canEditPages(userId: string, tenantId: string): Promise<boolean> {
  return hasRole(userId, tenantId, ['owner', 'editor', 'support']);
}

export async function canManageTenant(userId: string, tenantId: string): Promise<boolean> {
  return hasRole(userId, tenantId, ['owner']);
}

export async function canViewTenant(userId: string, tenantId: string): Promise<boolean> {
  return hasRole(userId, tenantId, ['owner', 'editor', 'viewer', 'support']);
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  return isUserSuperAdmin(userId);
}

export async function assertCanEditPages(userId: string, tenantId: string): Promise<void> {
  if (!(await canEditPages(userId, tenantId))) {
    throw new ForbiddenError('canEditPages');
  }
}

export async function assertCanManageTenant(userId: string, tenantId: string): Promise<void> {
  if (!(await canManageTenant(userId, tenantId))) {
    throw new ForbiddenError('canManageTenant');
  }
}

export async function assertCanViewTenant(userId: string, tenantId: string): Promise<void> {
  if (!(await canViewTenant(userId, tenantId))) {
    throw new ForbiddenError('canViewTenant');
  }
}
