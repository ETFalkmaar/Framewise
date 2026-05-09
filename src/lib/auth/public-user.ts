import type { User } from '@/types/database';

/** Public-facing shape of a user — strips secrets like password_hash. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

/** Strip secrets before passing user data across the trust boundary. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
  };
}
