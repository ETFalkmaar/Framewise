import type {
  AIAgent,
  AgentConversation,
  AgentKnowledge,
  AgentSettings,
  AgentVoiceConfig,
  AuditLog,
  KnowledgeBaseDocument,
  AvailabilityRule,
  BookingException,
  Notification,
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
import mediaSeed from './seeds/media.json';
import auditLogsSeed from './seeds/audit_logs.json';
import notificationsSeed from './seeds/notifications.json';
import availabilityRulesSeed from './seeds/availability_rules.json';
import bookingExceptionsSeed from './seeds/booking_exceptions.json';

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
  audit_logs: AuditLog;
  notifications: Notification;
  availability_rules: AvailabilityRule;
  booking_exceptions: BookingException;
  ai_agents: AIAgent;
  agent_settings: AgentSettings;
  agent_voice_configs: AgentVoiceConfig;
  knowledge_base_documents: KnowledgeBaseDocument;
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
  'audit_logs',
  'notifications',
  'availability_rules',
  'booking_exceptions',
  'ai_agents',
  'agent_settings',
  'agent_voice_configs',
  'knowledge_base_documents',
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
    ['media', mediaSeed as unknown as Media[]],
    ['audit_logs', auditLogsSeed as unknown as AuditLog[]],
    ['notifications', notificationsSeed as unknown as Notification[]],
    ['availability_rules', availabilityRulesSeed as unknown as AvailabilityRule[]],
    ['booking_exceptions', bookingExceptionsSeed as unknown as BookingException[]],
  ];

  for (const [name, rows] of pairs) {
    const table = store[name] as Map<string, { id: string }>;
    table.clear();
    for (const row of rows) {
      // Step 42: backfill the new `deleted_at` field on legacy
      // seed rows so soft-delete filtering doesn't accidentally
      // hide every seeded media item.
      // Step 46: backfill the new `version` field on legacy block
      // seed rows so the optimistic-concurrency check has a
      // starting token (1) for every existing block.
      // Step 47: backfill the publish-request lifecycle fields on
      // legacy tenant seeds — every tenant starts in `'none'` so
      // the resting state matches the type union.
      let normalised: typeof row = row;
      if (name === 'media' && !('deleted_at' in normalised)) {
        normalised = { ...normalised, deleted_at: null } as typeof row;
      }
      if (name === 'blocks' && !('version' in normalised)) {
        normalised = { ...normalised, version: 1 } as typeof row;
      }
      if (name === 'tenants' && !('publish_request_status' in normalised)) {
        normalised = {
          ...normalised,
          publish_request_status: 'none',
          publish_requested_at: null,
          publish_requested_by_user_id: null,
          publish_approval_notes: null,
          publish_approved_at: null,
          publish_approved_by_user_id: null,
          publish_rejected_at: null,
          publish_rejected_by_user_id: null,
        } as typeof row;
      }
      // Step 49 — booking flags on tenants. Demo Villa Curaçao
      // (slug `demo-villa`) is the Enterprise showcase, so it ships
      // `bookings_enabled: true`. Every other seed tenant defaults
      // to `false` and a `null` timezone.
      if (name === 'tenants' && !('bookings_enabled' in normalised)) {
        const isVilla = (normalised as { slug?: string }).slug === 'demo-villa';
        normalised = {
          ...normalised,
          bookings_enabled: isVilla,
          booking_timezone: isVilla ? 'America/Curacao' : null,
        } as typeof row;
      }
      // Step 55 — backfill the new calendar-feed token field on
      // every tenant row. Always `null` until the tenant owner
      // explicitly generates one from the admin UI.
      if (name === 'tenants' && !('calendar_feed_token' in normalised)) {
        normalised = {
          ...normalised,
          calendar_feed_token: null,
        } as typeof row;
      }
      // Step 56 — backfill AI-agent feature flag + linked agent id.
      // Demo seeds: both Pro + Enterprise tenants get the feature on
      // so the provision/configure flows are demoable. Villa starts
      // un-provisioned (showcases the activation flow); restaurant
      // starts pre-provisioned with a stub-agent id (showcases the
      // configured state).
      if (name === 'tenants' && !('ai_agent_enabled' in normalised)) {
        const slug = (normalised as { slug?: string }).slug;
        const isDemo = slug === 'demo-villa' || slug === 'demo-restaurant';
        normalised = {
          ...normalised,
          ai_agent_enabled: isDemo,
          ai_agent_id: null,
        } as typeof row;
      }
      // Step 49 — extend legacy bookings (villa-nights model) with
      // the new time-slot fields so the new repo + UI can read every
      // booking uniformly. `booking_type` defaults to `'all_day'`
      // for legacy rows; `start_time` / `end_time` derive from the
      // existing dates at midnight UTC.
      if (name === 'bookings' && !('booking_type' in normalised)) {
        const legacy = normalised as unknown as {
          start_date: string;
          end_date: string;
          persons: number;
          guest_name: string;
          guest_email: string;
          guest_phone: string | null;
          status: string;
          created_at: string;
        };
        const refYear = legacy.created_at?.slice(0, 4) ?? '2026';
        const refSuffix = (normalised.id as string).slice(-4).toUpperCase();
        normalised = {
          ...normalised,
          booking_type: 'all_day',
          start_time: `${legacy.start_date}T00:00:00.000Z`,
          end_time: `${legacy.end_date}T00:00:00.000Z`,
          party_size: legacy.persons,
          customer_name: legacy.guest_name,
          customer_email: legacy.guest_email,
          customer_phone: legacy.guest_phone,
          internal_notes: null,
          reference_code: `BK-${refYear}-${refSuffix}`,
          confirmed_at: legacy.status === 'confirmed' ? legacy.created_at : null,
          cancelled_at: legacy.status === 'cancelled' ? legacy.created_at : null,
          cancellation_reason: null,
          no_show_at: null,
        } as typeof row;
      }
      table.set(normalised.id, normalised);
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
