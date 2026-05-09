'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Tenant } from '@/types/database';
import type { PublicUser } from './public-user';

interface AuthContextValue {
  user: PublicUser | null;
  tenants: Tenant[];
  activeTenantId: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  tenants: [],
  activeTenantId: null,
});

export function AuthProvider({
  user,
  tenants,
  activeTenantId,
  children,
}: {
  user: PublicUser | null;
  tenants: Tenant[];
  activeTenantId: string | null;
  children: ReactNode;
}) {
  return (
    <AuthContext.Provider value={{ user, tenants, activeTenantId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useUser(): PublicUser {
  const { user } = useContext(AuthContext);
  if (!user) throw new Error('useUser() called outside of an authenticated context');
  return user;
}

export function useOptionalUser(): PublicUser | null {
  return useContext(AuthContext).user;
}

export function useUserTenants(): Tenant[] {
  return useContext(AuthContext).tenants;
}

export function useActiveTenantId(): string | null {
  return useContext(AuthContext).activeTenantId;
}
