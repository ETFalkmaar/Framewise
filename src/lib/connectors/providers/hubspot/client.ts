import { mapHubSpotError, hubspotNetworkError } from './errors';
import type { HubSpotAccountInfo } from './types';

const DEFAULT_BASE_URL = 'https://api.hubapi.com';
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Framewise/1.0 (+https://framewise-pi.vercel.app)';

export interface HubSpotClientOptions {
  /** OAuth `access_token` from the authorization-code exchange. */
  accessToken: string;
  /** Override for tests / staging. Default `https://api.hubapi.com`. */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 10s; UI flows use 5s. */
  timeoutMs?: number;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * REST client for the HubSpot v3 API.
 *
 * Tiny surface — only `getAccountInfo` is exposed because that's all
 * `handleOAuthCallback` needs. Future steps that actually push leads
 * will extend the class with `createContact`, `searchContacts`, etc.
 */
export class HubSpotClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HubSpotClientOptions) {
    if (!options.accessToken || options.accessToken.length === 0) {
      throw new Error('HubSpotClient: accessToken is required');
    }
    this.accessToken = options.accessToken;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * `GET /account-info/v3/details` — owner of the access token. The
   * `portalId` is the canonical Hub identifier we persist as the
   * connection's account display.
   */
  async getAccountInfo(): Promise<HubSpotAccountInfo> {
    return this.request<HubSpotAccountInfo>('/account-info/v3/details');
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
          Authorization: `Bearer ${this.accessToken}`,
          'User-Agent': USER_AGENT,
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        throw hubspotNetworkError(`request timed out after ${this.timeoutMs}ms`);
      }
      throw hubspotNetworkError((err as Error).message ?? String(err));
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
      throw mapHubSpotError(response, parsed);
    }
    return parsed as T;
  }
}
