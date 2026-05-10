import { mapStripeError, stripeNetworkError } from './errors';
import type { StripeAccount } from './types';

const DEFAULT_BASE_URL = 'https://api.stripe.com/v1';
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Framewise/1.0 (+https://framewise-pi.vercel.app)';
const STRIPE_VERSION = '2024-06-20';

export interface StripeClientOptions {
  /**
   * OAuth `access_token` from the Standard-account handshake. Used as
   * `Authorization: Bearer …`. For Standard accounts this is also the
   * connected-account secret key (`sk_*`-shaped).
   */
  accessToken: string;
  /** Override for tests / staging. Default `https://api.stripe.com/v1`. */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 10s; UI flows use 5s. */
  timeoutMs?: number;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * REST client for the Stripe v1 API.
 *
 * Tiny surface — only `getAccount` is exposed because that's all
 * `handleOAuthCallback` needs. Future steps that actually create
 * payment intents will extend the class with `createPaymentIntent`,
 * `getPayment`, etc.
 */
export class StripeClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: StripeClientOptions) {
    if (!options.accessToken || options.accessToken.length === 0) {
      throw new Error('StripeClient: accessToken is required');
    }
    this.accessToken = options.accessToken;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * Fetch the connected account. When `accountId` is omitted we hit
   * `/v1/account`, which Stripe interprets as "the account that owns
   * this access token" — exactly what we want right after an OAuth
   * exchange.
   */
  async getAccount(accountId?: string): Promise<StripeAccount> {
    const path = accountId ? `/accounts/${encodeURIComponent(accountId)}` : '/account';
    return this.request<StripeAccount>(path);
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
          'Stripe-Version': STRIPE_VERSION,
          'User-Agent': USER_AGENT,
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        throw stripeNetworkError(`request timed out after ${this.timeoutMs}ms`);
      }
      throw stripeNetworkError((err as Error).message ?? String(err));
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
      throw mapStripeError(response, parsed);
    }
    return parsed as T;
  }
}

/** Module-level helper: validate that a string looks like a Stripe `acct_*` id. */
export function isStripeAccountId(value: string): boolean {
  return /^acct_[A-Za-z0-9]{8,}$/.test(value);
}
