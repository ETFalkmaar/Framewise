import type { CountryCode, ProviderCategory, ProviderId } from '@/lib/countries';

import { CONNECTOR_ERROR_CODES, ConnectorError } from './errors';
import type { ConnectorDefinition } from './types';

const connectorRegistry: Map<ProviderId, ConnectorDefinition> = new Map();

/**
 * Register a connector definition. Idempotent re-registration of the
 * **same** object reference is a no-op (HMR / multiple route imports);
 * registering a *different* connector under the same id throws.
 */
export function registerConnector(connector: ConnectorDefinition): void {
  const existing = connectorRegistry.get(connector.id);
  if (existing && existing !== connector) {
    throw new ConnectorError(
      CONNECTOR_ERROR_CODES.ALREADY_REGISTERED,
      `Connector "${connector.id}" is already registered with a different definition`
    );
  }
  connectorRegistry.set(connector.id, connector);
}

export function getConnector(id: ProviderId): ConnectorDefinition | undefined {
  return connectorRegistry.get(id);
}

export function getAllConnectors(): ConnectorDefinition[] {
  return Array.from(connectorRegistry.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function getConnectorsByCategory(category: ProviderCategory): ConnectorDefinition[] {
  return getAllConnectors().filter((c) => c.category === category);
}

/**
 * Connectors offered to a given country. A connector with no
 * `availableIn` is treated as available everywhere — convenient for
 * provider-agnostic test doubles.
 */
export function getConnectorsForCountry(country: CountryCode): ConnectorDefinition[] {
  return getAllConnectors().filter((c) => !c.availableIn || c.availableIn.includes(country));
}

/** Test seam — empty the registry between vitest cases. */
export function __resetConnectorRegistry(): void {
  connectorRegistry.clear();
}
