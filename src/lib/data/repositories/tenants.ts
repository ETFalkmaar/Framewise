import type { Tenant } from '@/types/database';
import { createRepoProxy } from './_proxy';

export interface TenantsRepository {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  findByCustomDomain(domain: string): Promise<Tenant | null>;
  list(): Promise<Tenant[]>;
  create(data: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>): Promise<Tenant>;
  update(id: string, data: Partial<Tenant>): Promise<Tenant>;
  delete(id: string): Promise<void>;
}

const { proxy, set } = createRepoProxy<TenantsRepository>('tenantsRepo');
export const tenantsRepo = proxy;
export const setTenantsRepo = set;
