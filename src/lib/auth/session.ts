import { cookies } from 'next/headers';
import { getIronSession, type SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: string;
  activeTenantId?: string | null;
  isLoggedIn: boolean;
}

const DEV_FALLBACK_PASSWORD = 'framewise-mock-session-password-do-not-use-in-prod-please-change-me';

function getSessionPassword(): string {
  const fromEnv = process.env.SESSION_PASSWORD;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  // Only the live production runtime on Vercel must have a real secret.
  // Local builds and CI build steps (no VERCEL_ENV) use the dev fallback;
  // Vercel preview deploys also fall through unless the secret is set.
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('SESSION_PASSWORD env var missing or too short (>= 32 chars required)');
  }
  return DEV_FALLBACK_PASSWORD;
}

/** Built lazily so module imports stay safe when SESSION_PASSWORD is absent. */
export function getSessionOptions(): SessionOptions {
  return {
    password: getSessionPassword(),
    cookieName: 'framewise_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
      path: '/',
    },
  };
}

/**
 * Compatibility shim so older imports keep working. Resolves the password at
 * read-time, not at module-evaluation time.
 */
export const sessionOptions: SessionOptions = new Proxy({} as SessionOptions, {
  get(_target, prop, receiver) {
    return Reflect.get(getSessionOptions(), prop, receiver);
  },
});

/** Read/write session inside server components, route handlers and server actions. */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}
