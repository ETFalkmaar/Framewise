/**
 * Public data-access entry point.
 *
 * Import repositories from `@/lib/data` (NEVER from `@/lib/data/adapters/*`)
 * so the underlying implementation can be swapped without touching call sites.
 *
 * Today: mock adapter with in-memory store + JSON seeds.
 * Step 119: replaced by the Supabase adapter, no API change.
 */

import { mockAIAgentsRepo } from './adapters/mock/ai-agents';
import { mockAgentConversationsRepo } from './adapters/mock/agent-conversations';
import { mockAgentKnowledgeRepo } from './adapters/mock/agent-knowledge';
import { mockAgentSettingsRepo } from './adapters/mock/agent-settings';
import { mockAgentVoiceConfigsRepo } from './adapters/mock/agent-voice-configs';
import { mockKnowledgeBaseRepo } from './adapters/mock/knowledge-base';
import { mockAuditLogsRepo } from './adapters/mock/audit-logs';
import { mockAvailabilityRulesRepo } from './adapters/mock/availability-rules';
import { mockBlocksRepo } from './adapters/mock/blocks';
import { mockBookingExceptionsRepo } from './adapters/mock/booking-exceptions';
import { mockBookingsRepo } from './adapters/mock/bookings';
import { mockChecklistRepo } from './adapters/mock/checklist';
import { mockConnectionsRepo } from './adapters/mock/connections';
import { mockMediaRepo } from './adapters/mock/media';
import { mockNotificationsRepo } from './adapters/mock/notifications';
import { mockPageVersionsRepo } from './adapters/mock/page-versions';
import { mockPagesRepo } from './adapters/mock/pages';
import { mockSubscriptionsRepo } from './adapters/mock/subscriptions';
import { mockSupportHoursRepo } from './adapters/mock/support-hours';
import { mockTenantCountrySettingsRepo } from './adapters/mock/tenant-country-settings';
import { mockTenantsRepo } from './adapters/mock/tenants';
import { mockTokenAccessLogRepo } from './adapters/mock/token-access-log';
import { mockTranslationsRepo } from './adapters/mock/translations';
import { mockUsersRepo } from './adapters/mock/users';

import { aiAgentsRepo, setAIAgentsRepo } from './repositories/ai-agents';
import {
  agentConversationsRepo,
  setAgentConversationsRepo,
} from './repositories/agent-conversations';
import { agentKnowledgeRepo, setAgentKnowledgeRepo } from './repositories/agent-knowledge';
import { agentSettingsRepo, setAgentSettingsRepo } from './repositories/agent-settings';
import {
  agentVoiceConfigsRepo,
  setAgentVoiceConfigsRepo,
} from './repositories/agent-voice-configs';
import { knowledgeBaseRepo, setKnowledgeBaseRepo } from './repositories/knowledge-base';
import { auditLogsRepo, setAuditLogsRepo } from './repositories/audit-logs';
import { availabilityRulesRepo, setAvailabilityRulesRepo } from './repositories/availability-rules';
import { blocksRepo, setBlocksRepo } from './repositories/blocks';
import { bookingExceptionsRepo, setBookingExceptionsRepo } from './repositories/booking-exceptions';
import { bookingsRepo, setBookingsRepo } from './repositories/bookings';
import { checklistRepo, setChecklistRepo } from './repositories/checklist';
import { connectionsRepo, setConnectionsRepo } from './repositories/connections';
import { mediaRepo, setMediaRepo } from './repositories/media';
import { notificationsRepo, setNotificationsRepo } from './repositories/notifications';
import { pageVersionsRepo, setPageVersionsRepo } from './repositories/page-versions';
import { pagesRepo, setPagesRepo } from './repositories/pages';
import { subscriptionsRepo, setSubscriptionsRepo } from './repositories/subscriptions';
import { setSupportHoursRepo, supportHoursRepo } from './repositories/support-hours';
import {
  setTenantCountrySettingsRepo,
  tenantCountrySettingsRepo,
} from './repositories/tenant-country-settings';
import { setTenantsRepo, tenantsRepo } from './repositories/tenants';
import { setTokenAccessLogRepo, tokenAccessLogRepo } from './repositories/token-access-log';
import { setTranslationsRepo, translationsRepo } from './repositories/translations';
import { setUsersRepo, usersRepo } from './repositories/users';

// Wire mock implementations once at module load.
setAIAgentsRepo(mockAIAgentsRepo);
setAgentConversationsRepo(mockAgentConversationsRepo);
setAgentKnowledgeRepo(mockAgentKnowledgeRepo);
setAgentSettingsRepo(mockAgentSettingsRepo);
setAgentVoiceConfigsRepo(mockAgentVoiceConfigsRepo);
setKnowledgeBaseRepo(mockKnowledgeBaseRepo);
setAuditLogsRepo(mockAuditLogsRepo);
setAvailabilityRulesRepo(mockAvailabilityRulesRepo);
setBlocksRepo(mockBlocksRepo);
setBookingExceptionsRepo(mockBookingExceptionsRepo);
setBookingsRepo(mockBookingsRepo);
setChecklistRepo(mockChecklistRepo);
setConnectionsRepo(mockConnectionsRepo);
setMediaRepo(mockMediaRepo);
setNotificationsRepo(mockNotificationsRepo);
setPagesRepo(mockPagesRepo);
setPageVersionsRepo(mockPageVersionsRepo);
setSubscriptionsRepo(mockSubscriptionsRepo);
setSupportHoursRepo(mockSupportHoursRepo);
setTenantCountrySettingsRepo(mockTenantCountrySettingsRepo);
setTenantsRepo(mockTenantsRepo);
setTokenAccessLogRepo(mockTokenAccessLogRepo);
setTranslationsRepo(mockTranslationsRepo);
setUsersRepo(mockUsersRepo);

export {
  aiAgentsRepo,
  agentConversationsRepo,
  agentKnowledgeRepo,
  agentSettingsRepo,
  agentVoiceConfigsRepo,
  auditLogsRepo,
  knowledgeBaseRepo,
  availabilityRulesRepo,
  blocksRepo,
  bookingExceptionsRepo,
  bookingsRepo,
  checklistRepo,
  connectionsRepo,
  mediaRepo,
  notificationsRepo,
  pagesRepo,
  pageVersionsRepo,
  subscriptionsRepo,
  supportHoursRepo,
  tenantCountrySettingsRepo,
  tenantsRepo,
  tokenAccessLogRepo,
  translationsRepo,
  usersRepo,
};

export { resetStore, tableCounts } from './adapters/mock/store';
