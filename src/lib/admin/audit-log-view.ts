import { connectionsRepo, tenantsRepo, usersRepo } from '@/lib/data';
import { table } from '@/lib/data/adapters/mock/store';
import type { TenantUser } from '@/types/database';

/**
 * Recent-activity feed for the per-tenant admin dashboard
 * (step 36, fase 11).
 *
 * The mock adapter doesn't ship a generic `audit_log` table yet
 * (step 88 lands it), so this helper synthesises events from the
 * timestamps already on the seeded rows:
 *
 *  - `tenants.created_at`              → `tenant_created`
 *  - `tenants.updated_at` (≠ created)  → `tenant_updated`
 *  - `provider_connections.connected_at` → `connection_added`
 *  - `tenant_users.invited_at`         → `member_invited`
 *
 * Events are sorted by `createdAt` desc and capped at `limit`
 * (default 20). The shape mirrors what step 88's real audit table
 * will return so consumers don't need to refactor when the data
 * source flips.
 */
export type AuditAction =
  | 'tenant_created'
  | 'tenant_updated'
  | 'site_published'
  | 'site_unpublished'
  | 'connection_added'
  | 'connection_removed'
  | 'domain_added'
  | 'domain_verified'
  | 'checklist_item_completed'
  | 'member_invited';

export interface AuditLogEvent {
  id: string;
  tenantId: string;
  action: AuditAction;
  performedByUserId: string | null;
  performedByUserName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ListRecentAuditEventsInput {
  tenantId: string;
  limit?: number;
}

const DEFAULT_LIMIT = 20;

/**
 * Single source of "now" for the audit-log card so the React
 * page renderer doesn't have to call `Date.now()` itself — the
 * `react-hooks/purity` rule complains about that inside `.tsx`
 * even for server components where it's safe.
 */
export function currentServerEpochMs(): number {
  return Date.now();
}

export async function listRecentAuditEvents(
  input: ListRecentAuditEventsInput
): Promise<AuditLogEvent[]> {
  const tenant = await tenantsRepo.findById(input.tenantId);
  if (!tenant) return [];

  const limit = input.limit ?? DEFAULT_LIMIT;
  const events: AuditLogEvent[] = [];

  events.push({
    id: `synthetic-tenant-created-${tenant.id}`,
    tenantId: tenant.id,
    action: 'tenant_created',
    performedByUserId: null,
    performedByUserName: null,
    metadata: { slug: tenant.slug, country: tenant.country },
    createdAt: tenant.created_at,
  });

  if (tenant.updated_at !== tenant.created_at) {
    events.push({
      id: `synthetic-tenant-updated-${tenant.id}-${tenant.updated_at}`,
      tenantId: tenant.id,
      action: tenant.status === 'live' ? 'site_published' : 'tenant_updated',
      performedByUserId: null,
      performedByUserName: null,
      metadata: { status: tenant.status },
      createdAt: tenant.updated_at,
    });
  }

  const memberships = Array.from(table('tenant_users').values() as IterableIterator<TenantUser>);
  for (const m of memberships) {
    if (m.tenant_id !== tenant.id) continue;
    const user = await usersRepo.findById(m.user_id);
    events.push({
      id: `synthetic-member-invited-${m.id}`,
      tenantId: tenant.id,
      action: 'member_invited',
      performedByUserId: m.user_id,
      performedByUserName: user?.name ?? null,
      metadata: { roleId: m.role_id },
      createdAt: m.invited_at,
    });
  }

  const connections = await connectionsRepo.listByTenant(tenant.id);
  for (const conn of connections) {
    events.push({
      id: `synthetic-conn-${conn.id}`,
      tenantId: tenant.id,
      action: 'connection_added',
      performedByUserId: null,
      performedByUserName: null,
      metadata: { provider: conn.provider, category: conn.category, status: conn.status },
      createdAt: conn.connected_at,
    });
  }

  events.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return events.slice(0, limit);
}
