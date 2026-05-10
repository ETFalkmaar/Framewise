import { storeCredentials } from '../base';
import { InvalidCredentialsError, MissingFieldError, UnsupportedFlowError } from '../errors';
import type { ApiKeyField, ConnectorContext, ConnectorDefinition, FlowResult } from '../types';

export interface SubmitApiKeyInput {
  connector: ConnectorDefinition;
  credentials: Record<string, string>;
  context: ConnectorContext;
}

/**
 * Validate the supplied fields against the connector's `apiKey.fields`
 * schema, run `testConnection`, and persist the encrypted credentials
 * via the vault. Returns a `FlowResult` shaped for the route handler.
 *
 * - Required field missing → `MissingFieldError`.
 * - Field fails its `validation` rule → `MissingFieldError` (the user
 *   sees the field key; details land in `error.details`).
 * - `testConnection` returns `{ ok: false }` → `InvalidCredentialsError`
 *   so the route handler can render the provider's error message.
 */
export async function submitApiKeyCredentials(input: SubmitApiKeyInput): Promise<FlowResult> {
  const { connector, credentials, context } = input;
  if (connector.authMethod !== 'api_key' || !connector.apiKey) {
    throw new UnsupportedFlowError(connector.id, 'api_key');
  }

  // Strip empty optional values so they don't get persisted as "" in the
  // vault payload.
  const cleaned = pickFields(credentials, connector.apiKey.fields);
  for (const field of connector.apiKey.fields) {
    assertField(field, cleaned[field.key], connector.id);
  }

  const test = connector.testConnection
    ? await connector.testConnection(cleaned, context)
    : { ok: true };
  if (!test.ok) {
    throw new InvalidCredentialsError(connector.id, test.error);
  }

  const connectionId = await storeCredentials(connector, context, cleaned, test.metadata);
  return {
    success: true,
    connectionId,
    metadata: test.metadata,
  };
}

function pickFields(raw: Record<string, string>, fields: ApiKeyField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = raw[f.key];
    if (typeof v === 'string' && v.trim().length > 0) out[f.key] = v.trim();
  }
  return out;
}

function assertField(field: ApiKeyField, value: string | undefined, providerId: string): void {
  if (value === undefined || value.length === 0) {
    if (field.required) throw new MissingFieldError(field.key, providerId);
    return;
  }
  const v = field.validation;
  if (v?.minLength !== undefined && value.length < v.minLength) {
    throw new MissingFieldError(field.key, providerId);
  }
  if (v?.maxLength !== undefined && value.length > v.maxLength) {
    throw new MissingFieldError(field.key, providerId);
  }
  if (v?.pattern && !new RegExp(v.pattern).test(value)) {
    throw new MissingFieldError(field.key, providerId);
  }
}
