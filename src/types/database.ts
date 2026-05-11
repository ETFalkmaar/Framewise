/**
 * Database row types — 1:1 with the future Supabase schema.
 *
 * Conventions:
 * - Field names use snake_case (matches Supabase / Postgres).
 * - Enum-like fields are typed as string union types.
 * - Timestamps and dates are ISO-8601 strings (`new Date().toISOString()`).
 * - JSONB columns are typed as specific shapes where possible, otherwise
 *   `Record<string, unknown>`.
 *
 * The `Database` umbrella type at the bottom mirrors Supabase's
 * `Database` convention so generated client code can drop in later.
 */

export type ISODateTime = string;
export type ISODate = string; // YYYY-MM-DD
export type UUID = string;

// ────────────────────────────────────────────────────────────────────────────
// 1. tenants
// ────────────────────────────────────────────────────────────────────────────
export type Country = 'NL' | 'CW';
export type LocaleCode = 'nl' | 'fr' | 'en';
export type TenantStatus = 'onboarding' | 'live' | 'paused' | 'cancelled';

/**
 * Schema.org `@type` value used by `buildOrganizationLD`. Defaults to
 * `Organization` when null. Step 26 picks subtype based on the
 * tenant's vertical (`Restaurant` for hospitality, `LodgingBusiness`
 * for villas/holiday homes, `LocalBusiness` for everything else).
 */
export type OrganizationType = 'Organization' | 'LocalBusiness' | 'Restaurant' | 'LodgingBusiness';

/** A multi-tenant site instance (one Framewise customer site). */
export interface Tenant {
  id: UUID;
  slug: string;
  name: string;
  country: Country;
  vat_number: string | null;
  crib_number: string | null;
  subscription_plan_id: UUID;
  status: TenantStatus;
  custom_domain: string | null;
  default_locale: LocaleCode;
  enabled_locales: LocaleCode[];
  /**
   * Default OpenGraph image URL for the whole tenant. Page-level
   * `seo_meta.og_image_url` overrides this; both fall back to the
   * first image found in a page's blocks (see `resolveOgImage`).
   * Step 26.
   */
  og_image_url: string | null;
  /** schema.org `@type` for `buildOrganizationLD`. Step 26. */
  organization_type: OrganizationType | null;
  /** Twitter handle without the `@` prefix (e.g. `framewise_app`). Step 26. */
  twitter_handle: string | null;
  /**
   * Per-locale message shown on the branded maintenance page (step 34).
   * Falls back through the tenant's default locale → English → a
   * generic Framewise default. Keys outside `LocaleCode` are
   * ignored by the renderer.
   */
  maintenance_message_translations: Partial<Record<LocaleCode, string>> | null;
  /** URL of the logo shown on the maintenance page (step 34). */
  maintenance_logo_url: string | null;
  /** Email shown on the maintenance page so visitors can reach the customer (step 34). */
  maintenance_contact_email: string | null;
  /**
   * Site publish-request lifecycle (step 47, fase 13 part 1/2).
   * The customer asks for go-live via `requestSitePublish`; the
   * super-admin then approves (status → `live`) or rejects (with
   * required notes). `'none'` is the resting state for both fresh
   * onboarding tenants and previously-rejected ones that haven't
   * resubmitted yet.
   */
  publish_request_status: 'none' | 'pending' | 'approved' | 'rejected';
  publish_requested_at: ISODateTime | null;
  publish_requested_by_user_id: UUID | null;
  publish_approval_notes: string | null;
  publish_approved_at: ISODateTime | null;
  publish_approved_by_user_id: UUID | null;
  publish_rejected_at: ISODateTime | null;
  publish_rejected_by_user_id: UUID | null;
  /**
   * Booking module feature flag (step 49, fase 14 part 1/7). Only
   * Enterprise tenants get a `true` value; super-admin manually
   * toggles via `/admin/tenants/[id]` after onboarding confirmed
   * the plan. Default `false` keeps the booking-related routes
   * 403 for legacy seeds + non-enterprise tenants.
   */
  bookings_enabled: boolean;
  /**
   * IANA timezone string for the tenant's locale-aware slot
   * generation (step 50). Used at slot-generation time, not at
   * storage time — bookings always store ISO datetime in UTC.
   * Example: `'Europe/Amsterdam'`, `'America/Curacao'`.
   */
  booking_timezone: string | null;
  /**
   * Calendar-feed subscription token (step 55, fase 14 finale).
   * Random 32-char token the tenant owner generates from
   * `/account/bookings/calendar`. Embedded in the feed URL so
   * subscribers can rotate / revoke without re-issuing accounts.
   * `null` until the owner enables the feed.
   */
  calendar_feed_token: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. users
// ────────────────────────────────────────────────────────────────────────────
/** Identity record for a real human user (admin, owner, editor, viewer). */
export interface User {
  id: UUID;
  email: string;
  name: string;
  avatar_url: string | null;
  /**
   * Plain-text password for the mock adapter only (compared with `===`).
   * Step 119 swaps this for a Supabase Auth-managed bcrypt/argon2 hash so
   * application code keeps using `verifyCredentials()` unchanged.
   */
  password_hash: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  last_login_at: ISODateTime | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. roles
// ────────────────────────────────────────────────────────────────────────────
export type RoleName = 'owner' | 'editor' | 'viewer' | 'support';

/** Permission set for a tenant_users link. */
export interface Role {
  id: UUID;
  name: RoleName;
  permissions: Record<string, boolean>;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. tenant_users (junction)
// ────────────────────────────────────────────────────────────────────────────
/** Links a user to a tenant with a role. */
export interface TenantUser {
  id: UUID;
  tenant_id: UUID;
  user_id: UUID;
  role_id: UUID;
  invited_at: ISODateTime;
  joined_at: ISODateTime | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 5. subscription_plans
// ────────────────────────────────────────────────────────────────────────────
export type SubscriptionPlanCode = 'basic' | 'pro' | 'enterprise';
export type Currency = 'EUR' | 'USD' | 'ANG';

export interface SubscriptionPlanFeatures {
  blog: boolean;
  editor: boolean;
  booking: boolean;
  webshop: boolean;
  ai_agent_advanced: boolean;
  custom_domain: boolean;
  multi_language: boolean;
  [key: string]: boolean;
}

/** Pricing tier offered to tenants. */
export interface SubscriptionPlan {
  id: UUID;
  code: SubscriptionPlanCode;
  name: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  currency: Currency;
  features: SubscriptionPlanFeatures;
  support_hours_per_year: number;
  max_pages: number;
  max_languages: number;
  has_blog: boolean;
  has_editor: boolean;
  has_booking: boolean;
  has_webshop: boolean;
  has_ai_agent_advanced: boolean;
  created_at: ISODateTime;
}

// ────────────────────────────────────────────────────────────────────────────
// 6. subscriptions
// ────────────────────────────────────────────────────────────────────────────
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'trialing';

/** Active billing relationship between a tenant and a plan. */
export interface Subscription {
  id: UUID;
  tenant_id: UUID;
  plan_id: UUID;
  status: SubscriptionStatus;
  started_at: ISODateTime;
  current_period_start: ISODateTime;
  current_period_end: ISODateTime;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  created_at: ISODateTime;
}

// ────────────────────────────────────────────────────────────────────────────
// 7. support_hours_log
// ────────────────────────────────────────────────────────────────────────────
/** Time log against a tenant's contractual support quota. */
export interface SupportHoursLog {
  id: UUID;
  tenant_id: UUID;
  subscription_id: UUID;
  minutes_used: number;
  description: string;
  logged_by_user_id: UUID;
  logged_at: ISODateTime;
  period_start: ISODateTime;
  period_end: ISODateTime;
}

// ────────────────────────────────────────────────────────────────────────────
// 8. pages
// ────────────────────────────────────────────────────────────────────────────
export type PageStatus = 'draft' | 'published' | 'archived';

/**
 * Per-page SEO overrides. All fields optional; `buildPageMetadata`
 * falls back to the tenant defaults and the first hero/text block
 * when a key is missing. Stored as a JSONB column on `pages`. Step 26.
 */
export interface PageSeoMeta {
  /** Override for `<title>`. Per locale; falls back to first hero headline. */
  title_translations?: Partial<Record<LocaleCode, string>>;
  /** Override for `<meta name="description">`. Per locale. */
  description_translations?: Partial<Record<LocaleCode, string>>;
  /** Override for the page-level OG image URL. */
  og_image_url?: string | null;
  /**
   * Override for the canonical URL path. Useful when two slugs resolve
   * to logically the same page (e.g. `/contact` and `/get-in-touch`).
   * If absent, the canonical defaults to the request pathname.
   */
  canonical_path?: string | null;
  /**
   * `true` adds `<meta name="robots" content="noindex,nofollow">`.
   * Used for draft preview routes that shouldn't show up in search.
   */
  noindex?: boolean;
}

/** A single editable page on a tenant's site. */
export interface Page {
  id: UUID;
  tenant_id: UUID;
  slug: string;
  status: PageStatus;
  parent_id: UUID | null;
  order_index: number;
  /**
   * Per-page SEO overrides. `null` (or omitted) means "use tenant
   * defaults + block-derived fallbacks". Step 26.
   */
  seo_meta: PageSeoMeta | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  published_at: ISODateTime | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 9. page_versions
// ────────────────────────────────────────────────────────────────────────────
/** Snapshot of a page (with all its blocks) at a given revision. */
export interface PageVersion {
  id: UUID;
  page_id: UUID;
  version_number: number;
  snapshot: Record<string, unknown>;
  created_by_user_id: UUID;
  created_at: ISODateTime;
  comment: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 10. blocks
// ────────────────────────────────────────────────────────────────────────────
export type BlockType =
  | 'hero'
  | 'text'
  | 'image'
  | 'gallery'
  | 'cta'
  | 'faq'
  | 'pricing'
  | 'contact';

/** A single content block belonging to a page. */
export interface Block {
  id: UUID;
  page_id: UUID;
  block_type: BlockType;
  order_index: number;
  data: Record<string, unknown>;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  /**
   * Optimistic-concurrency token (step 46, fase 12 part 8/8).
   * Starts at 1 on insert and increments on every `update`. Block
   * saves that pass an `expectedVersion` and find it stale get a
   * conflict response instead of a silent overwrite, so two
   * editors can't blow away each other's work without seeing the
   * conflict dialog first.
   */
  version: number;
}

// ────────────────────────────────────────────────────────────────────────────
// 12. media
// ────────────────────────────────────────────────────────────────────────────
/** A binary asset (image, video, document) belonging to a tenant. */
export interface Media {
  id: UUID;
  tenant_id: UUID;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  public_url: string;
  alt_text: Record<LocaleCode, string>;
  width: number | null;
  height: number | null;
  uploaded_by_user_id: UUID;
  created_at: ISODateTime;
  /**
   * Soft-delete marker (step 42). `null` when the media is active;
   * a timestamp when the user (or the system) trashed it. Listing
   * helpers default to filtering these out — pass `{ includeDeleted:
   * true }` to surface them again.
   */
  deleted_at: ISODateTime | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 13. translations
// ────────────────────────────────────────────────────────────────────────────
export type TranslationNamespace = 'block' | 'page_meta' | 'global';

/** Localised content for a referenced entity (block, page meta, global key). */
export interface Translation {
  id: UUID;
  tenant_id: UUID;
  namespace: TranslationNamespace;
  reference_id: UUID;
  locale: LocaleCode;
  content: Record<string, unknown>;
  updated_at: ISODateTime;
}

// ────────────────────────────────────────────────────────────────────────────
// 14. bookings
// ────────────────────────────────────────────────────────────────────────────
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
/**
 * Step 49 — `time_slot` is the time-window booking model (restaurant
 * tables, services). `all_day` keeps the legacy villa-nights flow
 * working — `start_time` / `end_time` collapse to midnight on the
 * corresponding `start_date` / `end_date`.
 */
export type BookingType = 'time_slot' | 'all_day';

/** A guest booking against a bookable resource (villa, table, etc.). */
export interface Booking {
  id: UUID;
  tenant_id: UUID;
  status: BookingStatus;
  // ── Legacy nights model (step 13 onwards) ───────────────────────────
  start_date: ISODate;
  end_date: ISODate;
  persons: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  total_price_cents: number;
  currency: Currency;
  payment_status: PaymentStatus;
  payment_provider: string | null;
  payment_reference: string | null;
  notes: string | null;
  // ── Step 49 — time-slot booking model + lifecycle metadata ─────────
  /** Discriminator: `time_slot` uses start_time/end_time; `all_day` uses
   *  the start_date/end_date fields above. Legacy seeds default to
   *  `'all_day'` via the store loader's normalisation step. */
  booking_type: BookingType;
  /** ISO datetime — for `time_slot` the precise window, for `all_day`
   *  the start_date at 00:00 of the tenant's timezone. */
  start_time: ISODateTime;
  end_time: ISODateTime;
  /** Number of guests — alias / mirror of `persons` for the time-slot
   *  use case where "party size" is the natural phrasing. */
  party_size: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  /** Operator-only notes (kept out of the customer-facing emails). */
  internal_notes: string | null;
  /** Human-readable handle (`BK-2026-0042`). Unique per tenant per year. */
  reference_code: string;
  confirmed_at: ISODateTime | null;
  cancelled_at: ISODateTime | null;
  cancellation_reason: string | null;
  no_show_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ────────────────────────────────────────────────────────────────────────────
// 15. availability
// ────────────────────────────────────────────────────────────────────────────
export type AvailabilityStatus = 'available' | 'blocked' | 'booked';
export type AvailabilitySource = 'manual' | 'ical' | 'booking';

/** One row per (tenant, date) for a bookable resource. */
export interface Availability {
  id: UUID;
  tenant_id: UUID;
  date: ISODate;
  status: AvailabilityStatus;
  booking_id: UUID | null;
  source: AvailabilitySource;
  external_uid: string | null;
  notes: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 15b. availability_rules + booking_exceptions (step 50, fase 14 part 2/7)
// ────────────────────────────────────────────────────────────────────────────

/** 0 = Sunday, 6 = Saturday — matches the `Date.prototype.getUTCDay` return. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Recurring weekly availability rule (step 50). A tenant defines
 * one or more rules per day-of-week — e.g. lunch service 12:00-14:30
 * + diner service 18:00-22:00 — and the slot generator turns each
 * active rule into reservable time-slots for any future date.
 *
 * `start_time` / `end_time` use `HH:mm` 24-hour format (`"12:00"`,
 * `"22:30"`). Times are interpreted in the tenant's
 * `booking_timezone` at slot-generation time, not stored zoned here.
 */
export interface AvailabilityRule {
  id: UUID;
  tenant_id: UUID;
  name: string;
  is_active: boolean;
  day_of_week: DayOfWeek;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  slot_duration_minutes: number;
  max_party_size: number;
  max_concurrent_bookings: number;
  /** Cleaning / turnover time between slots; 0 packs slots back-to-back. */
  buffer_minutes: number;
  /** Effective window — `null` on both ends means "always active". */
  effective_from: ISODate | null;
  effective_until: ISODate | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/**
 * Per-date override on top of the weekly rules (step 50). Closures
 * for public holidays / private events, or simply different hours
 * for a one-off occasion (Christmas Eve early dinner, etc.).
 *
 * `date` is a YYYY-MM-DD string scoped to the tenant's timezone.
 * `is_closed: true` → slot generator returns `[]` for that date,
 * regardless of the day's rules. `is_closed: false` with custom
 * times overrides every rule's window with the same custom window.
 */
export interface BookingException {
  id: UUID;
  tenant_id: UUID;
  date: ISODate;
  reason: string;
  is_closed: boolean;
  custom_start_time: string | null; // HH:mm or null when is_closed
  custom_end_time: string | null;
  created_at: ISODateTime;
}

// ────────────────────────────────────────────────────────────────────────────
// 16. booking_settings
// ────────────────────────────────────────────────────────────────────────────
export interface CancellationPolicy {
  free_until_days_before: number;
  partial_refund_percentage: number;
  partial_until_days_before: number;
  [key: string]: unknown;
}

/** Per-tenant booking configuration (limits, pricing, policies). */
export interface BookingSettings {
  id: UUID;
  tenant_id: UUID;
  min_nights: number;
  max_nights: number;
  advance_notice_days: number;
  base_price_cents: number;
  weekend_surcharge_cents: number;
  currency: Currency;
  cancellation_policy: CancellationPolicy;
  updated_at: ISODateTime;
}

// ────────────────────────────────────────────────────────────────────────────
// 17. agent_conversations
// ────────────────────────────────────────────────────────────────────────────
export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: ISODateTime;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  tool_result?: unknown;
}

/** A conversation between a site visitor and the AI agent. */
export interface AgentConversation {
  id: UUID;
  tenant_id: UUID;
  session_id: string;
  started_at: ISODateTime;
  ended_at: ISODateTime | null;
  transcript: AgentMessage[];
  tools_used: string[];
  lead_captured: boolean;
  lead_email: string | null;
  lead_phone: string | null;
  summary: string | null;
  language: LocaleCode;
}

// ────────────────────────────────────────────────────────────────────────────
// 18. agent_knowledge
// ────────────────────────────────────────────────────────────────────────────
export type KnowledgeSourceType = 'page' | 'document' | 'manual';

/** Embedding chunk used by the AI agent for retrieval. */
export interface AgentKnowledge {
  id: UUID;
  tenant_id: UUID;
  source_type: KnowledgeSourceType;
  source_reference: string | null;
  content: string;
  embedding_dimensions: number;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ────────────────────────────────────────────────────────────────────────────
// 19. provider_connections
// ────────────────────────────────────────────────────────────────────────────
export type ConnectionCategory = 'accounting' | 'payments' | 'phone' | 'crm' | 'newsletter';
export type ConnectionProvider =
  | 'moneybird'
  | 'stripe'
  | 'mollie'
  | 'twilio'
  | 'hubspot'
  | 'mailchimp'
  | 'exact'
  | (string & {});
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'expired';
export type ConnectionAuthMethod = 'oauth' | 'api_key';

/** External provider integration owned by a tenant. */
export interface ProviderConnection {
  id: UUID;
  tenant_id: UUID;
  category: ConnectionCategory;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  auth_method: ConnectionAuthMethod;
  encrypted_token: string | null;
  metadata: Record<string, unknown>;
  connected_at: ISODateTime;
  last_used_at: ISODateTime | null;
  expires_at: ISODateTime | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 20. token_access_log
// ────────────────────────────────────────────────────────────────────────────
/**
 * What was attempted against an encrypted credential row.
 *
 * - `read`    — `getToken()` decryption.
 * - `write`   — `storeToken()` first-time encrypt + persist.
 * - `refresh` — `rotateToken()` re-encrypt with a new plaintext.
 * - `revoke`  — `revokeToken()` clear + mark disconnected.
 */
export type TokenAction = 'read' | 'write' | 'refresh' | 'revoke';

/** Audit log row for every access of a tenant's encrypted credentials. */
export interface TokenAccessLog {
  id: UUID;
  tenant_id: UUID;
  connection_id: UUID;
  action: TokenAction;
  timestamp: ISODateTime;
  user_id: UUID | null;
  ip_address: string | null;
  success: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// 21. setup_checklist_items (template)
// ────────────────────────────────────────────────────────────────────────────
export type ChecklistActionType = 'domain' | 'connection' | 'info';

/** Read-only template row defining one onboarding step. */
export interface SetupChecklistItem {
  id: UUID;
  country: Country;
  plan_code: SubscriptionPlanCode;
  category: string;
  label_nl: string;
  label_fr: string;
  label_en: string;
  required: boolean;
  order_index: number;
  action_type: ChecklistActionType;
}

// ────────────────────────────────────────────────────────────────────────────
// 22. tenant_checklist_status
// ────────────────────────────────────────────────────────────────────────────
export type ChecklistStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

/** Per-tenant progress on a single checklist item. */
export interface TenantChecklistStatus {
  id: UUID;
  tenant_id: UUID;
  /**
   * Template id from `src/lib/checklist/templates.ts` (e.g. `'cw-domain'`).
   *
   * Originally typed as `UUID` when the template lived in the
   * `setup_checklist_items` table; step 11 moved templates into code so
   * this is now a free-form string. Supabase migration in step 119 will
   * widen the column to `text`.
   */
  checklist_item_id: string;
  status: ChecklistStatus;
  completed_at: ISODateTime | null;
  notes: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 23. tenant_country_settings
// ────────────────────────────────────────────────────────────────────────────
export interface PostalAddress {
  street: string;
  city: string;
  postal_code: string;
  country: Country;
  [key: string]: unknown;
}

/** Country-scoped settings for a tenant (currency, timezone, etc.). */
export interface TenantCountrySettings {
  id: UUID;
  tenant_id: UUID;
  country: Country;
  currency: Currency;
  timezone: string;
  locale_default: LocaleCode;
  legal_entity_name: string;
  address: PostalAddress;
  updated_at: ISODateTime;
}

// ────────────────────────────────────────────────────────────────────────────
// notifications (step 48 — fase 13 part 2/2)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Stable notification type codes. The renderer picks the icon +
 * localised label based on the code so DB rows don't carry copy.
 * Future steps add more codes (booking_*, ai_agent_*, ...).
 */
export type NotificationType =
  | 'publish_requested'
  | 'publish_approved'
  | 'publish_rejected'
  | 'system';

/**
 * In-app notification (step 48). Sent to:
 *  - all super-admins on `publish_requested`
 *  - the tenant owner on `publish_approved` / `publish_rejected`
 *
 * `tenant_id` is nullable because future system-level events
 * (Framewise platform announcements, etc.) won't be tied to a
 * tenant. `action_url` is the URL the renderer follows when the
 * user clicks the notification body or "Bekijken" button — null
 * means "no actionable link", display only.
 */
export interface Notification {
  id: UUID;
  user_id: UUID;
  tenant_id: UUID | null;
  type: NotificationType;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  created_at: ISODateTime;
  read_at: ISODateTime | null;
}

// ────────────────────────────────────────────────────────────────────────────
// audit_logs (step 47 — fase 13 part 1/2)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Stable action codes for the audit trail. New codes are added as
 * features land; the renderer uses the code to pick an icon + a
 * localised label so the database doesn't carry copy.
 */
export type AuditLogAction =
  | 'site_publish_requested'
  | 'site_publish_cancelled'
  | 'site_publish_approved'
  | 'site_publish_rejected'
  | 'email_queued'
  // Step 49 — booking lifecycle.
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_no_show'
  | 'booking_notes_updated'
  | 'tenant_bookings_toggled'
  // Step 51 — anonymous public booking flow.
  | 'booking_created'
  // Step 54 — customer self-service (cancel / reschedule via reference code).
  | 'booking_email_verified'
  | 'booking_cancelled_by_customer'
  | 'booking_rescheduled_by_customer'
  // Step 55 — calendar feed lifecycle.
  | 'calendar_feed_token_generated'
  | 'calendar_feed_token_rotated'
  | 'calendar_feed_token_revoked'
  // Step 50 — availability rules + exceptions.
  | 'availability_rule_created'
  | 'availability_rule_updated'
  | 'availability_rule_deleted'
  | 'availability_rule_toggled'
  | 'booking_exception_created'
  | 'booking_exception_deleted';

/**
 * Tenant-scoped audit-log entry (step 47). Records meaningful
 * lifecycle events on a tenant's site — publish requests, approvals,
 * rejections — so super-admins can audit who did what and when.
 * Per-page snapshot history lives in `page_versions` (step 44) and
 * stays there; this table is for tenant-level, cross-page events.
 */
export interface AuditLog {
  id: UUID;
  tenant_id: UUID;
  action: AuditLogAction;
  /**
   * `null` for system-performed actions (step 48 — e.g. the email
   * stub queues messages on behalf of the platform, not a user).
   * User-initiated actions always populate this with the actor.
   */
  performed_by_user_id: UUID | null;
  /** Free-form context the renderer can show alongside the event. */
  metadata: Record<string, unknown>;
  created_at: ISODateTime;
}

// ────────────────────────────────────────────────────────────────────────────
// Database umbrella (mirrors Supabase Database<T> convention)
// ────────────────────────────────────────────────────────────────────────────
export interface Database {
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
}

export type TableName = keyof Database;
