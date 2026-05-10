import { getPayPalApiBaseUrl, type PayPalEnvironment } from './environment';
import { mapPayPalError, paypalNetworkError } from './errors';
import type { PayPalUserInfo } from './types';

const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Framewise/1.0 (+https://framewise-pi.vercel.app)';

export interface PayPalClientOptions {
  /** OAuth `access_token` from the LIPP handshake. */
  accessToken: string;
  /** Sandbox vs live environment — drives the API base URL. */
  environment: PayPalEnvironment;
  /** Per-request timeout in ms. Default 10s; UI flows use 5s. */
  timeoutMs?: number;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Override for tests / staging. Defaults to env-based base URL. */
  baseUrl?: string;
}

/**
 * REST client for PayPal's Identity API.
 *
 * Tiny surface — only `getUserInfo` is exposed because that's all
 * `handleOAuthCallback` needs. Future steps that actually create
 * orders/captures will extend the class with `createOrder`, etc.
 */
export class PayPalClient {
  private readonly accessToken: string;
  private readonly environment: PayPalEnvironment;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PayPalClientOptions) {
    if (!options.accessToken || options.accessToken.length === 0) {
      throw new Error('PayPalClient: accessToken is required');
    }
    this.accessToken = options.accessToken;
    this.environment = options.environment;
    this.baseUrl = (options.baseUrl ?? getPayPalApiBaseUrl(options.environment)).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * `GET /v1/identity/oauth2/userinfo?schema=paypalv1.1` — owner of
   * the access token. The `schema` query param picks the v1.1
   * payload shape (the v1 default is missing several useful fields).
   */
  async getUserInfo(): Promise<PayPalUserInfo> {
    return this.request<PayPalUserInfo>('/v1/identity/oauth2/userinfo?schema=paypalv1.1');
  }

  /** Reflect the active environment for callers (e.g. metadata population). */
  getEnvironment(): PayPalEnvironment {
    return this.environment;
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
        throw paypalNetworkError(`request timed out after ${this.timeoutMs}ms`);
      }
      throw paypalNetworkError((err as Error).message ?? String(err));
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
      throw mapPayPalError(response, parsed);
    }
    return parsed as T;
  }
}
