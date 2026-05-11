import { tenantsRepo } from '@/lib/data';

export interface GoLiveCelebrationData {
  /** Path-prefix URL on the tenant's slug. */
  siteUrl: string;
  /** Set when the tenant configured a custom domain — celebrated more prominently. */
  customDomain: string | null;
  /** When the super-admin flipped the tenant to live. */
  publishedAt: Date;
  /** Floor of days between tenant creation and publish — minimum 1. */
  daysFromOnboarding: number;
  hasCustomDomain: boolean;
}

/**
 * Compute the data the go-live celebration component needs (step
 * 48, fase 13 part 2/2). Returns `null` for tenants that aren't
 * live yet — the caller skips rendering the celebration.
 *
 * `daysFromOnboarding` floors to 1 even for same-day approvals so
 * the copy never reads "in 0 dagen klaar gekomen".
 */
export async function getGoLiveCelebrationData(
  tenantId: string
): Promise<GoLiveCelebrationData | null> {
  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) return null;
  if (tenant.status !== 'live') return null;

  const publishedAt = tenant.publish_approved_at
    ? new Date(tenant.publish_approved_at)
    : new Date();
  const onboardingDate = new Date(tenant.created_at);

  const daysFromOnboarding = Math.max(
    1,
    Math.floor((publishedAt.getTime() - onboardingDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    siteUrl: `/sites/${tenant.slug}`,
    customDomain: tenant.custom_domain,
    publishedAt,
    daysFromOnboarding,
    hasCustomDomain: tenant.custom_domain !== null && tenant.custom_domain.length > 0,
  };
}
