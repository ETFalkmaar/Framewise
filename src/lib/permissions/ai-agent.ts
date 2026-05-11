import { isUserSuperAdmin } from '@/lib/auth';
import { canEditPages, canManageTenant } from '@/lib/auth/permissions';
import type { AgentChannel, SubscriptionPlanCode, Tenant } from '@/types/database';

/**
 * AI agent permission gates (step 56, fase 15 part 1/9).
 *
 * Three levels of access, same shape as the booking-module helpers:
 *
 *  - `canViewAgent` — read the agent settings page (editors+).
 *    Requires the tenant flag to be on. Super-admin bypasses.
 *
 *  - `canConfigureAgent` — mutate settings, run provision /
 *    deprovision actions. Tenant owners only. Super-admin bypasses.
 *
 *  - `canEnableAgent` — toggle the per-tenant `ai_agent_enabled`
 *    flag. Super-admin only — the customer can't switch on a paid
 *    feature themselves.
 */
export async function canViewAgent(userId: string, tenant: Tenant): Promise<boolean> {
  if (isUserSuperAdmin(userId)) return true;
  if (!tenant.ai_agent_enabled) return false;
  return canEditPages(userId, tenant.id);
}

export async function canConfigureAgent(userId: string, tenant: Tenant): Promise<boolean> {
  if (isUserSuperAdmin(userId)) return true;
  if (!tenant.ai_agent_enabled) return false;
  return canManageTenant(userId, tenant.id);
}

export function canEnableAgent(userId: string): boolean {
  return isUserSuperAdmin(userId);
}

/**
 * Channel matrix per subscription plan. Enterprise gets the full
 * voice + text bundle; Pro tenants are text-only; Basic doesn't
 * get the agent at all (the page 404s via `tenant.ai_agent_enabled`).
 */
export function agentChannelsForPlan(plan: SubscriptionPlanCode | null): AgentChannel {
  if (plan === 'enterprise') return 'both';
  if (plan === 'pro') return 'text';
  return 'text';
}
