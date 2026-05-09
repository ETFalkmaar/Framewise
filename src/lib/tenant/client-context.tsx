'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Subscription, SubscriptionPlan, Tenant } from '@/types/database';

interface TenantContextValue {
  tenant: Tenant | null;
  plan: SubscriptionPlan | null;
  subscription: Subscription | null;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  plan: null,
  subscription: null,
});

export function TenantProvider({
  tenant,
  plan,
  subscription,
  children,
}: {
  tenant: Tenant | null;
  plan: SubscriptionPlan | null;
  subscription: Subscription | null;
  children: ReactNode;
}) {
  return (
    <TenantContext.Provider value={{ tenant, plan, subscription }}>
      {children}
    </TenantContext.Provider>
  );
}

/** Returns the current tenant; throws if there isn't one. */
export function useTenant(): Tenant {
  const { tenant } = useContext(TenantContext);
  if (!tenant) {
    throw new Error('useTenant() called outside of a tenant context');
  }
  return tenant;
}

/** Like `useTenant`, but returns `null` instead of throwing. */
export function useOptionalTenant(): Tenant | null {
  return useContext(TenantContext).tenant;
}

/** Returns the current plan; throws if there isn't one. */
export function usePlan(): SubscriptionPlan {
  const { plan } = useContext(TenantContext);
  if (!plan) {
    throw new Error('usePlan() called outside of a tenant context');
  }
  return plan;
}

export function useOptionalPlan(): SubscriptionPlan | null {
  return useContext(TenantContext).plan;
}
