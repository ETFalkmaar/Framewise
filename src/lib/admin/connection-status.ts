import { connectionsRepo } from '@/lib/data';
import { getAllProviders } from '@/lib/countries';
import type { ConnectionCategory, ProviderConnection } from '@/types/database';

/**
 * Per-provider connection state used by the dashboard's
 * "Connectoren" card (step 36, fase 11).
 *
 * The card always shows every provider in the registry so the
 * super-admin can see what's *missing* as well as what's wired —
 * a tenant with zero accounting connections shouldn't have to
 * scroll to discover that. `isConnected` is `true` only for
 * connections with status `connected`; `expired` / `error` /
 * `disconnected` all surface as "not actively connected" with
 * the `hasError` flag set when relevant.
 */
export type ConnectionStatusCategory = ConnectionCategory;

export interface ConnectorWithStatus {
  providerId: string;
  providerName: string;
  category: ConnectionStatusCategory;
  connection: ProviderConnection | null;
  isConnected: boolean;
  hasError: boolean;
  errorMessage: string | null;
  /** ISO timestamp of the last successful sync. `null` when never synced. */
  lastSyncAt: string | null;
}

export async function getConnectionStatusForTenant(
  tenantId: string
): Promise<ConnectorWithStatus[]> {
  const providers = getAllProviders();
  const connections = await connectionsRepo.listByTenant(tenantId);
  const byProvider = new Map<string, ProviderConnection>();
  for (const c of connections) byProvider.set(c.provider, c);

  return providers.map<ConnectorWithStatus>((provider) => {
    const conn = byProvider.get(provider.id) ?? null;
    const isConnected = conn?.status === 'connected';
    const hasError = conn?.status === 'error' || conn?.status === 'expired';
    return {
      providerId: provider.id,
      providerName: provider.name,
      category: provider.category as ConnectionStatusCategory,
      connection: conn,
      isConnected,
      hasError,
      errorMessage:
        hasError && typeof conn?.metadata?.['errorMessage'] === 'string'
          ? (conn.metadata['errorMessage'] as string)
          : null,
      lastSyncAt: conn?.last_used_at ?? null,
    };
  });
}

/**
 * Group the flat connector list by category — useful for the
 * card layout that lists Accounting / Payments / CRM / etc. side
 * by side. Empty categories are dropped so a tenant on Basic
 * doesn't render an empty "CRM" header.
 */
export function groupConnectorsByCategory(
  connectors: ConnectorWithStatus[]
): Array<{ category: ConnectionStatusCategory; items: ConnectorWithStatus[] }> {
  const buckets = new Map<ConnectionStatusCategory, ConnectorWithStatus[]>();
  for (const c of connectors) {
    const list = buckets.get(c.category) ?? [];
    list.push(c);
    buckets.set(c.category, list);
  }
  const order: ConnectionStatusCategory[] = [
    'accounting',
    'payments',
    'crm',
    'newsletter',
    'phone',
  ];
  const result: Array<{ category: ConnectionStatusCategory; items: ConnectorWithStatus[] }> = [];
  for (const category of order) {
    const items = buckets.get(category);
    if (items && items.length > 0) result.push({ category, items });
  }
  return result;
}
