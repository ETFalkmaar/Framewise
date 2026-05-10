import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONNECTOR_ERROR_CODES,
  ConnectorError,
  __resetConnectorRegistry,
  getAllConnectors,
  getConnector,
  getConnectorsByCategory,
  getConnectorsForCountry,
  mockApiKeyConnector,
  mockOAuthConnector,
  registerConnector,
  type ConnectorDefinition,
} from '@/lib/connectors';

beforeEach(() => {
  __resetConnectorRegistry();
});
afterEach(() => {
  // Re-register the test doubles so other test files keep working
  // when run after this one in the same vitest worker.
  __resetConnectorRegistry();
  registerConnector(mockOAuthConnector);
  registerConnector(mockApiKeyConnector);
});

describe('connector registry', () => {
  it('registerConnector + getConnector round-trip', () => {
    registerConnector(mockApiKeyConnector);
    const fetched = getConnector('mock-api-key');
    expect(fetched).toBe(mockApiKeyConnector);
  });

  it('getConnector returns undefined for unknown id', () => {
    expect(getConnector('does-not-exist')).toBeUndefined();
  });

  it('getAllConnectors returns sorted-by-id list', () => {
    registerConnector(mockOAuthConnector);
    registerConnector(mockApiKeyConnector);
    const ids = getAllConnectors().map((c) => c.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('getConnectorsByCategory filters', () => {
    registerConnector(mockOAuthConnector); // accounting
    registerConnector(mockApiKeyConnector); // newsletter
    expect(getConnectorsByCategory('accounting').map((c) => c.id)).toEqual(['mock-oauth']);
    expect(getConnectorsByCategory('newsletter').map((c) => c.id)).toEqual(['mock-api-key']);
    expect(getConnectorsByCategory('phone')).toEqual([]);
  });

  it('getConnectorsForCountry returns connectors with no availableIn (universal)', () => {
    registerConnector(mockOAuthConnector);
    registerConnector(mockApiKeyConnector);
    expect(
      getConnectorsForCountry('NL')
        .map((c) => c.id)
        .sort()
    ).toEqual(['mock-api-key', 'mock-oauth']);
    expect(
      getConnectorsForCountry('CW')
        .map((c) => c.id)
        .sort()
    ).toEqual(['mock-api-key', 'mock-oauth']);
  });

  it('getConnectorsForCountry honours availableIn restriction', () => {
    const nlOnly: ConnectorDefinition = {
      id: 'nl-only-mock',
      category: 'phone',
      authMethod: 'api_key',
      availableIn: ['NL'],
      apiKey: { instructions: { nl: '', fr: '', en: '' }, fields: [] },
    };
    registerConnector(nlOnly);
    expect(getConnectorsForCountry('NL').map((c) => c.id)).toContain('nl-only-mock');
    expect(getConnectorsForCountry('CW').map((c) => c.id)).not.toContain('nl-only-mock');
  });

  it('idempotent re-registration of the same object is a no-op', () => {
    registerConnector(mockApiKeyConnector);
    expect(() => registerConnector(mockApiKeyConnector)).not.toThrow();
    expect(getAllConnectors()).toHaveLength(1);
  });

  it('registering a different definition under the same id throws ALREADY_REGISTERED', () => {
    registerConnector(mockApiKeyConnector);
    const dupe: ConnectorDefinition = { ...mockApiKeyConnector };
    let caught: unknown;
    try {
      registerConnector(dupe);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConnectorError);
    expect((caught as ConnectorError).code).toBe(CONNECTOR_ERROR_CODES.ALREADY_REGISTERED);
  });
});
