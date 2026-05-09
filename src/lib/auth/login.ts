import { usersRepo } from '@/lib/data';
import type { User } from '@/types/database';
import { getSession } from './session';

/**
 * Verifies a user's credentials against the data layer.
 *
 * Mock implementation: plain `===` comparison against `password_hash`.
 * Step 119 swaps this for a Supabase Auth call (or bcrypt/argon2 compare
 * against a real hash) without changing the call signature.
 */
export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  if (!email || !password) return null;
  const user = await usersRepo.findByEmail(email.toLowerCase());
  if (!user) return null;
  if (user.password_hash !== password) return null;
  return user;
}

export async function startSession(
  userId: string,
  activeTenantId: string | null = null
): Promise<void> {
  const session = await getSession();
  session.userId = userId;
  session.activeTenantId = activeTenantId;
  session.isLoggedIn = true;
  await session.save();
}

export async function endSession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
