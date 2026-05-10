import type {
  AgentConversation,
  AgentKnowledge,
  Availability,
  Block,
  Booking,
  BookingSettings,
  Media,
  Page,
  PageVersion,
  ProviderConnection,
  Role,
  SetupChecklistItem,
  Subscription,
  SubscriptionPlan,
  SupportHoursLog,
  TableName,
  Tenant,
  TenantChecklistStatus,
  TenantCountrySettings,
  TenantUser,
  TokenAccessLog,
  Translation,
  User,
} from '@/types/database';

import tenantsSeed from './seeds/tenants.json';
import usersSeed from './seeds/users.json';
import rolesSeed from './seeds/roles.json';
import tenantUsersSeed from './seeds/tenant_users.json';
import subscriptionPlansSeed from './seeds/subscription_plans.json';
import subscriptionsSeed from './seeds/subscriptions.json';
import pagesSeed from './seeds/pages.json';
import blocksSeed from './seeds/blocks.json';
import bookingsSeed from './seeds/bookings.json';
import availabilitySeed from './seeds/availability.json';
import setupChecklistItemsSeed from './seeds/setup_checklist_items.json';
import providerConnectionsSeed from './seeds/provider_connections.json';
import tenantCountrySettingsSeed from './seeds/tenant_country_settings.json';
import tenantChecklistStatusSeed from './seeds/tenant_checklist_status.json';
import tokenAccessLogSeed from './seeds/token_access_log.json';

/**
 * In-memory store for the mock adapter. One Map per table keyed by `id`.
 *
 * Seed loading happens at module load — the JSON seed files are imported
 * statically so they land in the production bundle without filesystem reads.
 *
 * Replaced wholesale by the Supabase adapter in step 119.
 */
type Store = {
  [K in TableName]: Map<string, MockRow<K>>;
};

type MockRow<K extends TableName> = {
  tenants: Tenant;
  users: User;
  roles: Role;
  tenant_users: TenantUser;
  subscription_plans: SubscriptionPlan;
  subscriptions: Subscription;
  support_hours_log: SupportHoursLog;
  pages: Page;
  page_versions: PageVersion;
  blocks: Block;
  media: Media;
  translations: Translation;
  bookings: Booking;
  availability: Availability;
  booking_settings: BookingSettings;
  agent_conversations: AgentConversation;
  agent_knowledge: AgentKnowledge;
  provider_connections: ProviderConnection;
  token_access_log: TokenAccessLog;
  setup_checklist_items: SetupChecklistItem;
  tenant_checklist_status: TenantChecklistStatus;
  tenant_country_settings: TenantCountrySettings;
}[K];

const TABLES: TableName[] = [
  'tenants',
  'users',
  'roles',
  'tenant_users',
  'subscription_plans',
  'subscriptions',
  'support_hours_log',
  'pages',
  'page_versions',
  'blocks',
  'media',
  'translations',
  'bookings',
  'availability',
  'booking_settings',
  'agent_conversations',
  'agent_knowledge',
  'provider_connections',
  'token_access_log',
  'setup_checklist_items',
  'tenant_checklist_status',
  'tenant_country_settings',
];

function emptyStore(): Store {
  return Object.fromEntries(TABLES.map((t) => [t, new Map()])) as Store;
}

const store: Store = emptyStore();

function loadSeeds(): void {
  const pairs: [TableName, Array<{ id: string }>][] = [
    ['tenants', tenantsSeed as unknown as Tenant[]],
    ['users', usersSeed as unknown as User[]],
    ['roles', rolesSeed as unknown as Role[]],
    ['tenant_users', tenantUsersSeed as unknown as TenantUser[]],
    ['subscription_plans', subscriptionPlansSeed as unknown as SubscriptionPlan[]],
    ['subscriptions', subscriptionsSeed as unknown as Subscription[]],
    ['pages', pagesSeed as unknown as Page[]],
    ['blocks', blocksSeed as unknown as Block[]],
    ['bookings', bookingsSeed as unknown as Booking[]],
    ['availability', availabilitySeed as unknown as Availability[]],
    ['setup_checklist_items', setupChecklistItemsSeed as unknown as SetupChecklistItem[]],
    ['provider_connections', providerConnectionsSeed as unknown as ProviderConnection[]],
    ['tenant_country_settings', tenantCountrySettingsSeed as unknown as TenantCountrySettings[]],
    ['tenant_checklist_status', tenantChecklistStatusSeed as unknown as TenantChecklistStatus[]],
    ['token_access_log', tokenAccessLogSeed as unknown as TokenAccessLog[]],
  ];

  for (const [name, rows] of pairs) {
    const table = store[name] as Map<string, { id: string }>;
    table.clear();
    for (const row of rows) {
      table.set(row.id, row);
    }
  }
}

loadSeeds();

// ────────────────────────────────────────────────────────────────────────────
// Public helpers
// ────────────────────────────────────────────────────────────────────────────

export function table<K extends TableName>(name: K): Map<string, MockRow<K>> {
  return store[name];
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getTimestamp(): string {
  return new Date().toISOString();
}

/** Wipe the store and re-load seeds. Useful in tests. */
export function resetStore(): void {
  for (const name of TABLES) {
    store[name].clear();
  }
  loadSeeds();
}

/** Counts per table — used by the /debug/data route. */
export function tableCounts(): Record<TableName, number> {
  return Object.fromEntries(TABLES.map((t) => [t, store[t].size])) as Record<TableName, number>;
}
