import { mapMoneybirdError, networkError } from './errors';
import type { MoneybirdAdministration } from './types';

const DEFAULT_BASE_URL = 'https://moneybird.com/api/v2';
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Framewise/1.0 (+https://framewise-pi.vercel.app)';

export interface MoneybirdClientOptions {
  accessToken: string;
  /** Optional administration scope; required for resource-level endpoints. */
  administrationId?: string;
  /** Override for tests / staging. Defaults to `https://moneybird.com/api/v2`. */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 10s; UI flows use 5s. */
  timeoutMs?: number;
  /**
   * Optional fetch override. The framework defaults to `globalThis.fetch`
   * but tests inject a stubbed `fetch` so they don't hit the network.
   */
  fetchImpl?: typeof fetch;
}

/**
 * Minimal HTTP wrapper around the Moneybird REST API. Only the
 * endpoints we actively use are exposed — keep the surface small so
 * the mock-fetch test matrix stays maintainable.
 */
export class MoneybirdClient {
  private readonly accessToken: string;
  readonly administrationId?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MoneybirdClientOptions) {
    if (!options.accessToken || options.accessToken.length === 0) {
      throw new Error('MoneybirdClient: accessToken is required');
    }
    this.accessToken = options.accessToken;
    this.administrationId = options.administrationId;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * GET /administrations.json — returns every administration the
   * personal access token can see. The connector uses this for
   * `testConnection`: a non-empty result is the simplest possible
   * proof the token is valid.
   */
  async listAdministrations(): Promise<MoneybirdAdministration[]> {
    const data = await this.request<MoneybirdAdministration[]>('GET', '/administrations.json');
    if (!Array.isArray(data)) {
      // Defensive — the API contract guarantees an array, but never trust upstream.
      return [];
    }
    return data;
  }

  /** GET /administrations/<id>.json — single administration lookup. */
  async getAdministration(id: string): Promise<MoneybirdAdministration> {
    return this.request<MoneybirdAdministration>(
      'GET',
      `/administrations/${encodeURIComponent(id)}.json`
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal request helper. Centralised so timeout, headers, error
  // mapping and JSON parsing are consistent across endpoints.
  // ──────────────────────────────────────────────────────────────────
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          'User-Agent': USER_AGENT,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        throw networkError(`request timed out after ${this.timeoutMs}ms`);
      }
      throw networkError((err as Error).message ?? String(err));
    } finally {
      clearTimeout(timer);
    }

    // Always try to parse JSON for both success and error bodies — the
    // error message is often inside the body, not the headers.
    let parsed: unknown = undefined;
    const text = await response.text();
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      throw mapMoneybirdError(response, parsed);
    }
    return parsed as T;
  }
}
