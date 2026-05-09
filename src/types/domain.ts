/**
 * Domain types — business-logic friendly views over the database rows.
 *
 * Conventions:
 * - camelCase identifiers (idiomatic TS in component code).
 * - Composite types for common joins (e.g. PageWithBlocks).
 * - Conversion helpers handle the snake_case ↔ camelCase boundary so UI code
 *   never has to.
 */

import type {
  Block,
  Booking,
  Page,
  Subscription,
  SubscriptionPlan,
  Tenant,
  User,
} from './database';

// ────────────────────────────────────────────────────────────────────────────
// Composite views
// ────────────────────────────────────────────────────────────────────────────

/** A page together with its ordered list of blocks. */
export interface PageWithBlocks {
  page: Page;
  blocks: Block[];
}

/** A tenant with its currently-active subscription and plan, when present. */
export interface TenantWithSubscription {
  tenant: Tenant;
  subscription: Subscription | null;
  plan: SubscriptionPlan | null;
}

/** A booking enriched with the tenant it belongs to. */
export interface BookingWithTenant {
  booking: Booking;
  tenant: Tenant;
}

// ────────────────────────────────────────────────────────────────────────────
// Camel-case mirrors of the DB types (subset; expand on demand)
// ────────────────────────────────────────────────────────────────────────────

export interface UserDomain {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface TenantDomain {
  id: string;
  slug: string;
  name: string;
  country: Tenant['country'];
  vatNumber: string | null;
  cribNumber: string | null;
  subscriptionPlanId: string;
  status: Tenant['status'];
  customDomain: string | null;
  defaultLocale: Tenant['default_locale'];
  enabledLocales: Tenant['enabled_locales'];
  createdAt: string;
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Conversion helpers — DB row ↔ domain object
// ────────────────────────────────────────────────────────────────────────────

export function userToDomain(row: User): UserDomain {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

export function tenantToDomain(row: Tenant): TenantDomain {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    country: row.country,
    vatNumber: row.vat_number,
    cribNumber: row.crib_number,
    subscriptionPlanId: row.subscription_plan_id,
    status: row.status,
    customDomain: row.custom_domain,
    defaultLocale: row.default_locale,
    enabledLocales: row.enabled_locales,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
