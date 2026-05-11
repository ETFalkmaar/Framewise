/**
 * Public data-access entry point.
 *
 * Import repositories from `@/lib/data` (NEVER from `@/lib/data/adapters/*`)
 * so the underlying implementation can be swapped without touching call sites.
 *
 * Today: mock adapter with in-memory store + JSON seeds.
 * Step 119: replaced by the Supabase adapter, no API change.
 */

import { mockAgentConversationsRepo } from './adapters/mock/agent-conversations';
import { mockAgentKnowledgeRepo } from './adapters/mock/agent-knowledge';
import { mockAuditLogsRepo } from './adapters/mock/audit-logs';
import { mockBlocksRepo } from './adapters/mock/blocks';
import { mockBookingsRepo } from './adapters/mock/bookings';
import { mockChecklistRepo } from './adapters/mock/checklist';
import { mockConnectionsRepo } from './adapters/mock/connections';
import { mockMediaRepo } from './adapters/mock/media';
import { mockPageVersionsRepo } from './adapters/mock/page-versions';
import { mockPagesRepo } from './adapters/mock/pages';
import { mockSubscriptionsRepo } from './adapters/mock/subscriptions';
import { mockSupportHoursRepo } from './adapters/mock/support-hours';
import { mockTenantCountrySettingsRepo } from './adapters/mock/tenant-country-settings';
import { mockTenantsRepo } from './adapters/mock/tenants';
import { mockTokenAccessLogRepo } from './adapters/mock/token-access-log';
import { mockTranslationsRepo } from './adapters/mock/translations';
import { mockUsersRepo } from './adapters/mock/users';

import {
  agentConversationsRepo,
  setAgentConversationsRepo,
} from './repositories/agent-conversations';
import { agentKnowledgeRepo, setAgentKnowledgeRepo } from './repositories/agent-knowledge';
import { auditLogsRepo, setAuditLogsRepo } from './repositories/audit-logs';
import { blocksRepo, setBlocksRepo } from './repositories/blocks';
import { bookingsRepo, setBookingsRepo } from './repositories/bookings';
import { checklistRepo, setChecklistRepo } from './repositories/checklist';
import { connectionsRepo, setConnectionsRepo } from './repositories/connections';
import { mediaRepo, setMediaRepo } from './repositories/media';
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
setAgentConversationsRepo(mockAgentConversationsRepo);
setAgentKnowledgeRepo(mockAgentKnowledgeRepo);
setAuditLogsRepo(mockAuditLogsRepo);
setBlocksRepo(mockBlocksRepo);
setBookingsRepo(mockBookingsRepo);
setChecklistRepo(mockChecklistRepo);
setConnectionsRepo(mockConnectionsRepo);
setMediaRepo(mockMediaRepo);
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
  agentConversationsRepo,
  agentKnowledgeRepo,
  auditLogsRepo,
  blocksRepo,
  bookingsRepo,
  checklistRepo,
  connectionsRepo,
  mediaRepo,
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
