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

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_PASSWORD env var missing or too short (>= 32 chars required)');
  }
  return DEV_FALLBACK_PASSWORD;
}

export const sessionOptions: SessionOptions = {
  password: getSessionPassword(),
  cookieName: 'framewise_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
    path: '/',
  },
};

/** Read/write session inside server components, route handlers and server actions. */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
