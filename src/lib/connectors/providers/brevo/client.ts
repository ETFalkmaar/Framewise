import { brevoNetworkError, mapBrevoError } from './errors';
import type { BrevoAccount } from './types';

const DEFAULT_BASE_URL = 'https://api.brevo.com/v3';
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Framewise/1.0 (+https://framewise-pi.vercel.app)';

export interface BrevoClientOptions {
  /** Personal API key, prefixed `xkeysib-`. */
  apiKey: string;
  /** Override for tests / staging. Default `https://api.brevo.com/v3`. */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 10s; UI flows use 5s. */
  timeoutMs?: number;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * REST client for the Brevo v3 API.
 *
 * Note the **custom `api-key` header** — Brevo doesn't use
 * `Authorization: Bearer …` like everyone else. Tests assert this
 * shape so a future "helpful" edit doesn't accidentally switch to
 * Authorization.
 *
 * Tiny surface — only `getAccount` is exposed because that's all
 * `testConnection` needs. Future steps that actually send emails
 * will extend the class with `sendTransactionalEmail`,
 * `createContact`, etc.
 */
export class BrevoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BrevoClientOptions) {
    if (!options.apiKey || options.apiKey.length === 0) {
      throw new Error('BrevoClient: apiKey is required');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * `GET /v3/account` — owner of the API key. Brevo surfaces the
   * personal info, address, AND the plan list (which can have
   * multiple entries when free + paid add-ons co-exist).
   */
  async getAccount(): Promise<BrevoAccount> {
    return this.request<BrevoAccount>('/account');
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
          // Brevo expects a custom `api-key` header — NOT
          // `Authorization: Bearer …`. This is the most common
          // mistake when integrating Brevo for the first time;
          // tests assert the wire shape.
          'api-key': this.apiKey,
          'User-Agent': USER_AGENT,
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        throw brevoNetworkError(`request timed out after ${this.timeoutMs}ms`);
      }
      throw brevoNetworkError((err as Error).message ?? String(err));
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
      throw mapBrevoError(response, parsed);
    }
    return parsed as T;
  }
}

/** Module-level helper: validate a string against the Brevo key shape. */
export function isBrevoKey(value: string): boolean {
  return /^xkeysib-[a-fA-F0-9]+-[a-zA-Z0-9]+$/.test(value);
}
