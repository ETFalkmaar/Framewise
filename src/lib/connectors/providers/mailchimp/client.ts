import { mailchimpNetworkError, mapMailchimpError } from './errors';
import type { MailchimpAccount } from './types';

const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Framewise/1.0 (+https://framewise-pi.vercel.app)';

export interface MailchimpClientOptions {
  /** OAuth `access_token` from the authorization-code exchange. */
  accessToken: string;
  /**
   * Region-specific REST root from `/oauth2/metadata`, e.g.
   * `https://us1.api.mailchimp.com`. The `/3.0` segment is appended
   * internally — pass the bare host.
   */
  apiEndpoint: string;
  /** Per-request timeout in ms. Default 10s; UI flows use 5s. */
  timeoutMs?: number;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * REST client for the Mailchimp Marketing API v3.0.
 *
 * Two non-obvious wire-shape rules tested below:
 *
 *  - **Region-aware**: every Mailchimp account lives on a specific
 *    data center (us1, us2, eu1, …). The OAuth metadata endpoint is
 *    the only way to discover it; we cache `api_endpoint` on the
 *    credentials envelope so the client doesn't have to re-derive.
 *  - **`Authorization: OAuth <token>`**: NOT `Bearer`. Tests assert
 *    this so a future "helpful" edit can't regress to Bearer auth.
 *
 * Tiny surface — only `getAccount` is exposed because that's all
 * `handleOAuthCallback` needs. Future steps that push subscribers
 * will extend with `addToList`, `getLists`, etc.
 */
export class MailchimpClient {
  private readonly accessToken: string;
  private readonly apiEndpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MailchimpClientOptions) {
    if (!options.accessToken || options.accessToken.length === 0) {
      throw new Error('MailchimpClient: accessToken is required');
    }
    if (!options.apiEndpoint || options.apiEndpoint.length === 0) {
      throw new Error('MailchimpClient: apiEndpoint is required');
    }
    this.accessToken = options.accessToken;
    this.apiEndpoint = options.apiEndpoint.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * `GET /3.0/` — the API root. Mailchimp uses this as a "ping"
   * endpoint, but the response includes rich account metadata we
   * surface on the connection card.
   */
  async getAccount(): Promise<MailchimpAccount> {
    return this.request<MailchimpAccount>('/');
  }

  /** Reflect the resolved API endpoint back to callers — useful in tests. */
  getApiEndpoint(): string {
    return this.apiEndpoint;
  }

  // ──────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.apiEndpoint}/3.0${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          // Mailchimp uses `OAuth <token>` — NOT `Bearer <token>`.
          // Tests assert this exact wire shape.
          Authorization: `OAuth ${this.accessToken}`,
          'User-Agent': USER_AGENT,
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        throw mailchimpNetworkError(`request timed out after ${this.timeoutMs}ms`);
      }
      throw mailchimpNetworkError((err as Error).message ?? String(err));
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
      throw mapMailchimpError(response, parsed);
    }
    return parsed as T;
  }
}
