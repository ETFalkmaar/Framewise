import { createHash } from 'node:crypto';

import { mapEBoekhoudenError, networkError } from './errors';
import { getCachedSession, invalidateCachedSession, setCachedSession } from './session-cache';
import type { EBoekhoudenAdministration, EBoekhoudenSessionResponse } from './types';

const DEFAULT_BASE_URL = 'https://api.e-boekhouden.nl/v1';
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Framewise/1.0 (+https://framewise-pi.vercel.app)';

export interface EBoekhoudenClientOptions {
  /** Per-customer User API Token entered in the wizard. */
  userApiToken: string;
  /** Integrator Source API Token from `EBOEKHOUDEN_SOURCE_API_TOKEN`. */
  sourceApiToken: string;
  /** Override for tests / staging. Default `https://api.e-boekhouden.nl/v1`. */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 10s; UI flows use 5s. */
  timeoutMs?: number;
  /**
   * Optional override for the session-cache key. Defaults to a
   * SHA-256 of `userApiToken` so two clients sharing the same token
   * also share the cached session (and therefore the same provider
   * rate-limit budget).
   */
  cacheKey?: string;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * REST client for the e-Boekhouden v1 API.
 *
 * Two-token model: every request sends a short-lived **session token**
 * obtained from `POST /session` using the customer's User API Token +
 * Framewise's Source API Token. Sessions live ~60 minutes upstream;
 * we cache them for 55 minutes (safety margin) in
 * `session-cache.ts`.
 *
 * Auto-recovery: if any authenticated request returns 401, the
 * session cache is invalidated and the request is retried exactly
 * once with a freshly-minted session. After two 401s in a row we
 * surface `InvalidCredentialsError` so the UI can ask the user for
 * a new token.
 */
export class EBoekhoudenClient {
  private readonly userApiToken: string;
  private readonly sourceApiToken: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly cacheKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: EBoekhoudenClientOptions) {
    if (!options.userApiToken || options.userApiToken.length === 0) {
      throw new Error('EBoekhoudenClient: userApiToken is required');
    }
    if (!options.sourceApiToken || options.sourceApiToken.length === 0) {
      throw new Error('EBoekhoudenClient: sourceApiToken is required');
    }
    this.userApiToken = options.userApiToken;
    this.sourceApiToken = options.sourceApiToken;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.cacheKey = options.cacheKey ?? hashCacheKey(this.userApiToken);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * `POST /session` — exchange the user + source tokens for a
   * short-lived bearer. The result is cached automatically; callers
   * normally go through `ensureSessionToken()` instead.
   */
  async startSession(): Promise<string> {
    const response = await this.rawFetch('/session', {
      method: 'POST',
      headers: this.baseHeaders(),
      body: JSON.stringify({
        accessToken: this.userApiToken,
        source: this.sourceApiToken,
      }),
    });
    const body = await readBody(response);
    if (!response.ok) {
      throw mapEBoekhoudenError(response, body);
    }
    const session = body as EBoekhoudenSessionResponse;
    if (!session?.token || typeof session.expires !== 'string') {
      throw mapEBoekhoudenError(new Response(null, { status: 502, statusText: 'Bad Gateway' }), {
        message: 'session response missing token/expires',
      });
    }
    setCachedSession(this.cacheKey, session.token, session.expires);
    return session.token;
  }

  /**
   * `DELETE /session` — best-effort cleanup. Failures are intentionally
   * swallowed because `endSession` is usually called from `finally`
   * blocks where the original error is the one the caller cares about.
   */
  async endSession(): Promise<void> {
    const cached = getCachedSession(this.cacheKey);
    if (!cached) return;
    try {
      await this.rawFetch('/session', {
        method: 'DELETE',
        headers: { ...this.baseHeaders(), Authorization: `Bearer ${cached}` },
      });
    } catch {
      // Best-effort: never re-throw from teardown.
    } finally {
      invalidateCachedSession(this.cacheKey);
    }
  }

  /** `GET /administration` — single endpoint, used by `testConnection`. */
  async getAdministration(): Promise<EBoekhoudenAdministration> {
    return this.authenticatedRequest<EBoekhoudenAdministration>('/administration');
  }

  // ──────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────

  /**
   * Cached-or-create session token. The two-step retry happens here,
   * not in `authenticatedRequest`, so the caller's request body is
   * built with a fresh token after a 401.
   */
  private async ensureSessionToken(): Promise<string> {
    const cached = getCachedSession(this.cacheKey);
    if (cached) return cached;
    return this.startSession();
  }

  private async authenticatedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    let token = await this.ensureSessionToken();
    let response = await this.rawFetch(path, this.withAuth(init, token));

    if (response.status === 401) {
      // Stale session — drop it, mint a new one, retry exactly once.
      invalidateCachedSession(this.cacheKey);
      token = await this.startSession();
      response = await this.rawFetch(path, this.withAuth(init, token));
    }

    const body = await readBody(response);
    if (!response.ok) {
      throw mapEBoekhoudenError(response, body);
    }
    return body as T;
  }

  private baseHeaders(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    };
  }

  private withAuth(init: RequestInit, token: string): RequestInit {
    return {
      ...init,
      headers: {
        ...this.baseHeaders(),
        ...(init.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
      },
    };
  }

  private async rawFetch(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        throw networkError(`request timed out after ${this.timeoutMs}ms`);
      }
      throw networkError((err as Error).message ?? String(err));
    } finally {
      clearTimeout(timer);
    }
  }
}

/** SHA-256 of the User API Token, hex-encoded. Stable + opaque. */
function hashCacheKey(userApiToken: string): string {
  return createHash('sha256').update(userApiToken).digest('hex');
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
