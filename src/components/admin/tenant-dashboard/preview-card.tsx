import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Tenant } from '@/types/database';

interface PreviewCopy {
  title: string;
  openInNewTab: string;
  maintenanceMode: string;
  cancelled: string;
}

export interface PreviewCardProps {
  tenant: Tenant;
  copy: PreviewCopy;
}

/**
 * Klant-site preview op de per-tenant dashboard (step 36). Geen
 * embedded iframe — Vercel's COEP headers blokkeren cross-origin
 * iframes voor de meeste browsers in deze setup, dus we tonen
 * een prominent link + de huidige URL. Voor `cancelled` tenants
 * geen preview (terminaal).
 */
export function PreviewCard({ tenant, copy }: PreviewCardProps) {
  if (tenant.status === 'cancelled') {
    return (
      <Card data-testid="preview-card-cancelled" className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-sm">{copy.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-destructive text-xs">{copy.cancelled}</CardContent>
      </Card>
    );
  }

  const path = tenant.custom_domain ? `https://${tenant.custom_domain}` : `/sites/${tenant.slug}`;

  return (
    <Card data-testid="preview-card">
      <CardHeader>
        <CardTitle className="text-sm">{copy.title}</CardTitle>
        {tenant.status !== 'live' && (
          <CardDescription className="text-xs">{copy.maintenanceMode}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="preview-open-link"
          className="ring-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
        >
          🌐 {copy.openInNewTab}
        </a>
        <p className="text-muted-foreground mt-3 font-mono text-[11px] break-all">{path}</p>
      </CardContent>
    </Card>
  );
}
