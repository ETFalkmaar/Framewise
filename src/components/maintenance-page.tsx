import type { Tenant } from '@/types/database';

export function MaintenancePage({ tenant }: { tenant: Tenant }) {
  const isOnboarding = tenant.status === 'onboarding';
  const headline = isOnboarding ? 'Site coming soon' : 'Site temporarily unavailable';
  const detail = isOnboarding
    ? `${tenant.name} is being set up. Please check back soon.`
    : `${tenant.name} is currently paused. Please contact the site owner.`;

  return (
    <main
      data-testid="tenant-maintenance"
      className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center px-6 py-12"
    >
      <div className="text-center">
        <h1 className="text-display-xl font-bold tracking-tight">{headline}</h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-lg">{detail}</p>
      </div>
    </main>
  );
}
