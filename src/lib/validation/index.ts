// Errors
export {
  ValidationError,
  VALIDATION_ERROR_CODES,
  parseOrThrow,
  zodIssuesToValidationError,
  type ValidationErrorCode,
  type ValidationIssue,
} from './errors';

// Helpers
export { localeSchema, localesArraySchema } from './helpers/locale';
export { countrySchema, vatNumberSchema, cribNumberSchema } from './helpers/country';
export { isoDateTimeSchema, isoDateSchema, futureDateSchema } from './helpers/iso-date';
export { slugSchema, slugify } from './helpers/slug';

// Entity schemas
export {
  tenantInsertSchema,
  tenantUpdateSchema,
  tenantRowSchema,
  type TenantInsert,
  type TenantUpdate,
  type TenantRow,
} from './schemas/tenant';
export {
  userInsertSchema,
  userUpdateSchema,
  userRowSchema,
  type UserInsert,
  type UserUpdate,
  type UserRow,
} from './schemas/user';
export {
  subscriptionInsertSchema,
  subscriptionUpdateSchema,
  type SubscriptionInsert,
  type SubscriptionUpdate,
} from './schemas/subscription';
export {
  pageInsertSchema,
  pageUpdateSchema,
  type PageInsert,
  type PageUpdate,
} from './schemas/page';
export {
  blockInsertSchema,
  blockUpdateSchema,
  blockTypeSchema,
  type BlockInsert,
  type BlockUpdate,
} from './schemas/block';
export {
  bookingInsertSchema,
  bookingUpdateSchema,
  type BookingInsert,
  type BookingUpdate,
} from './schemas/booking';
export { mediaInsertSchema, type MediaInsert } from './schemas/media';
export {
  translationUpsertSchema,
  translationNamespaceSchema,
  type TranslationUpsert,
} from './schemas/translation';
export {
  agentMessageSchema,
  agentConversationInsertSchema,
  agentKnowledgeUpsertSchema,
  type AgentConversationInsert,
  type AgentKnowledgeUpsert,
} from './schemas/agent';
export {
  connectionInsertSchema,
  connectionCategorySchema,
  connectionStatusSchema,
  connectionAuthMethodSchema,
  type ConnectionInsert,
} from './schemas/connection';
export { checklistTemplateRowSchema, checklistStatusSchema } from './schemas/checklist';
export { supportHoursLogInsertSchema, type SupportHoursLogInsert } from './schemas/support-hours';

// Cross-entity rules
export {
  checkBookingAvailability,
  type BookingAvailabilityResult,
} from './rules/booking-availability';
export { tenantHasFeature, assertFeature } from './rules/plan-features';
export { canTransitionTo, assertTransition } from './rules/tenant-status';
