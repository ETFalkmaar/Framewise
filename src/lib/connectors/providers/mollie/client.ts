import { mapMollieError, mollieNetworkError } from './errors';
import type { MollieKeyType, MollieOrganization, MolliePaymentMethod } from './types';

const DEFAULT_BASE_URL = 'https://api.mollie.com/v2';
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Framewise/1.0 (+https://framewise-pi.vercel.app)';

const KEY_TYPE_RE = /^(test|live)_[a-zA-Z0-9]{20,}$/;

export interface MollieClientOptions {
  /** Personal API key, prefixed `test_` or `live_`. */
  apiKey: string;
  /** Override for tests / staging. Default `https://api.mollie.com/v2`. */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 10s; UI flows use 5s. */
  timeoutMs?: number;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * REST client for the Mollie v2 API.
 *
 * Tiny surface — only the two endpoints `testConnection` needs are
 * exposed (`getOrganization`, `listMethods`). Future steps that
 * actually create payments will extend the class with `createPayment`,
 * `getPayment`, etc.
 */
export class MollieClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MollieClientOptions) {
    if (!options.apiKey || options.apiKey.length === 0) {
      throw new Error('MollieClient: apiKey is required');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * Inspect the API key prefix to derive the mode. Throws when the
   * key doesn't match either prefix — Mollie keys always start with
   * `test_` or `live_`.
   */
  getKeyType(): MollieKeyType {
    if (this.apiKey.startsWith('test_')) return 'test';
    if (this.apiKey.startsWith('live_')) return 'live';
    throw new Error(
      `MollieClient: API key must start with "test_" or "live_" (got "${this.apiKey.slice(0, 6)}…")`
    );
  }

  /** `GET /v2/organizations/me` — owner of the key. */
  async getOrganization(): Promise<MollieOrganization> {
    return this.request<MollieOrganization>('/organizations/me');
  }

  /**
   * `GET /v2/methods` — all enabled payment methods. Mollie wraps the
   * list in an envelope; we hand callers the bare array.
   */
  async listMethods(): Promise<MolliePaymentMethod[]> {
    const envelope = await this.request<{
      _embedded?: { methods?: MolliePaymentMethod[] };
    }>('/methods');
    return envelope._embedded?.methods ?? [];
  }

  // ──────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': USER_AGENT,
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        throw mollieNetworkError(`request timed out after ${this.timeoutMs}ms`);
      }
      throw mollieNetworkError((err as Error).message ?? String(err));
    } finally {
      clearTimeout(timer);
    }

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
      throw mapMollieError(response, parsed);
    }
    return parsed as T;
  }
}

/** Module-level helper: validate a string against the Mollie key shape. */
export function isMollieKey(value: string): boolean {
  return KEY_TYPE_RE.test(value);
}
