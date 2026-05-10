import { mapPipedriveError, pipedriveNetworkError } from './errors';
import type { PipedriveEnvelope, PipedriveUser } from './types';

const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Framewise/1.0 (+https://framewise-pi.vercel.app)';

export interface PipedriveClientOptions {
  /** OAuth `access_token` from the authorization-code exchange. */
  accessToken: string;
  /**
   * Region-specific REST root from the OAuth token response, e.g.
   * `https://framewise-test.pipedrive.com`. The `/api/v1` segment is
   * appended internally — pass the bare domain.
   */
  apiDomain: string;
  /** Per-request timeout in ms. Default 10s; UI flows use 5s. */
  timeoutMs?: number;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * REST client for the Pipedrive v1 API.
 *
 * Region-aware: every Pipedrive company runs on its own
 * `<company>.pipedrive.com` host (returned by the OAuth handshake as
 * `api_domain`). The client appends `/api/v1` and unwraps Pipedrive's
 * standard `{ success, data }` envelope so callers see clean
 * domain objects.
 *
 * Tiny surface — only `getCurrentUser` is exposed because that's all
 * `handleOAuthCallback` needs. Future steps that push leads will
 * extend with `searchPersons`, `createPerson`, etc.
 */
export class PipedriveClient {
  private readonly accessToken: string;
  private readonly apiDomain: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PipedriveClientOptions) {
    if (!options.accessToken || options.accessToken.length === 0) {
      throw new Error('PipedriveClient: accessToken is required');
    }
    if (!options.apiDomain || options.apiDomain.length === 0) {
      throw new Error('PipedriveClient: apiDomain is required');
    }
    this.accessToken = options.accessToken;
    this.apiDomain = options.apiDomain.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * `GET /api/v1/users/me` — owner of the access token. Pipedrive
   * surfaces useful onboarding metadata here: `company_id`,
   * `company_name`, `company_domain`, locale, currency.
   */
  async getCurrentUser(): Promise<PipedriveUser> {
    return this.request<PipedriveUser>('/users/me');
  }

  /** Reflect the resolved API domain back to callers — useful in tests. */
  getApiDomain(): string {
    return this.apiDomain;
  }

  // ──────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.apiDomain}/api/v1${path.startsWith('/') ? path : `/${path}`}`;
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
        throw pipedriveNetworkError(`request timed out after ${this.timeoutMs}ms`);
      }
      throw pipedriveNetworkError((err as Error).message ?? String(err));
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
      throw mapPipedriveError(response, parsed);
    }

    // Pipedrive wraps every successful response in
    // `{ success: true, data: T, additional_data?: ... }`. Unwrap
    // `data` for callers; if the envelope is missing for whatever
    // reason, treat the parsed payload as `T` directly.
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      const env = parsed as PipedriveEnvelope<T>;
      if (env.success === false) {
        throw mapPipedriveError(response, parsed);
      }
      return env.data;
    }
    return parsed as T;
  }
}
