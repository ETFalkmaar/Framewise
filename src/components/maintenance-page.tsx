import Image from 'next/image';

import {
  hasMaintenanceBranding,
  resolveMaintenanceHeadline,
  resolveMaintenanceMessage,
} from '@/lib/maintenance';
import type { LocaleCode, Tenant } from '@/types/database';

/**
 * Branded maintenance shell (step 34, fase 10).
 *
 * Customer tenants can drop a logo URL, a contact email, and a
 * per-locale message in their settings; this view picks them up
 * via the `lib/maintenance` helpers. Tenants without any of
 * those fields fall back to a generic Framewise frame so the
 * page never looks broken.
 *
 * The component is purely server-rendered and depends only on
 * the `Tenant` row + the request locale — no client islands, no
 * `useEffect`. The locale layout (and the public route guard
 * from step 32) decide *when* to show it.
 */
export function MaintenancePage({
  tenant,
  locale,
}: {
  tenant: Tenant;
  locale?: LocaleCode;
}): React.JSX.Element {
  const resolvedLocale: LocaleCode = locale ?? (tenant.default_locale as LocaleCode);
  const headline = resolveMaintenanceHeadline(resolvedLocale);
  const message = resolveMaintenanceMessage(tenant, resolvedLocale);
  const branded = hasMaintenanceBranding(tenant);

  return (
    <main
      data-testid="tenant-maintenance"
      data-branded={branded ? 'true' : 'false'}
      className="from-background via-background to-muted/40 relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b px-6 py-12 text-center"
    >
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6">
        {tenant.maintenance_logo_url ? (
          <Image
            src={tenant.maintenance_logo_url}
            alt={`${tenant.name} logo`}
            width={120}
            height={120}
            className="ring-border/60 h-24 w-24 rounded-full object-cover ring-1"
            data-testid="maintenance-logo"
          />
        ) : (
          <div
            aria-hidden
            className="bg-primary/10 text-primary ring-border/60 flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ring-1"
          >
            {tenant.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="space-y-2">
          <p
            data-testid="maintenance-tenant-name"
            className="text-muted-foreground font-mono text-xs tracking-wide uppercase"
          >
            {tenant.name}
          </p>
          <h1 className="text-display-lg font-bold tracking-tight">{headline}</h1>
          <p
            data-testid="maintenance-message"
            className="text-muted-foreground mx-auto max-w-lg text-base"
          >
            {message}
          </p>
        </div>
        {tenant.maintenance_contact_email && (
          <a
            data-testid="maintenance-contact"
            href={`mailto:${tenant.maintenance_contact_email}`}
            className="text-foreground hover:bg-muted ring-border inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
          >
            ✉ {tenant.maintenance_contact_email}
          </a>
        )}
        <p className="text-muted-foreground/70 mt-8 font-mono text-[10px] tracking-wide uppercase">
          Powered by Framewise
        </p>
      </div>
    </main>
  );
}
