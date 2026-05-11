import type { Tenant } from '@/types/database';
import { createRepoProxy } from './_proxy';

/**
 * Step 47 — publish-request lifecycle fields are filled in by the
 * adapter on insert (every new tenant starts at `'none'`), so the
 * `create` payload type omits them. Callers that need a non-default
 * starting state can pass `Partial<...>` through `update` right
 * after the create.
 */
type TenantCreateInput = Omit<
  Tenant,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'publish_request_status'
  | 'publish_requested_at'
  | 'publish_requested_by_user_id'
  | 'publish_approval_notes'
  | 'publish_approved_at'
  | 'publish_approved_by_user_id'
  | 'publish_rejected_at'
  | 'publish_rejected_by_user_id'
>;

export interface TenantsRepository {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  findByCustomDomain(domain: string): Promise<Tenant | null>;
  list(): Promise<Tenant[]>;
  create(data: TenantCreateInput): Promise<Tenant>;
  update(id: string, data: Partial<Tenant>): Promise<Tenant>;
  delete(id: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<TenantsRepository>('tenantsRepo');
export const tenantsRepo = proxy;
export const setTenantsRepo = set;
