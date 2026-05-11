import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import type { AuditAction, AuditLogEvent } from '@/lib/admin';

interface AuditCopy {
  title: string;
  empty: string;
  by: string;
  ago: string;
  viewAll: string;
  actionLabels: Record<AuditAction, string>;
}

const ACTION_ICON: Record<AuditAction, string> = {
  tenant_created: '🆕',
  tenant_updated: '✏️',
  site_published: '🚀',
  site_unpublished: '🛠️',
  connection_added: '🔌',
  connection_removed: '⛔',
  domain_added: '🌐',
  domain_verified: '✅',
  checklist_item_completed: '☑️',
  member_invited: '👤',
};

export interface AuditLogCardProps {
  events: AuditLogEvent[];
  copy: AuditCopy;
  /**
   * Reference timestamp (epoch ms) for "X ago" math. Required so
   * the component itself stays pure — the page that renders this
   * card snapshots `Date.now()` once and passes it in.
   */
  now: number;
  tenantId: string;
}

/**
 * Recent-activity feed on the per-tenant dashboard (step 36),
 * with the "View all" deep-link added in step 37 to point at
 * the dedicated audit-log viewer.
 *
 * Server component — the "X ago" string is computed from the
 * caller-supplied `now`, so each render is deterministic given
 * the same inputs.
 */
export function AuditLogCard({ events, copy, now, tenantId }: AuditLogCardProps) {
  const referenceMs = now;

  return (
    <Card data-testid="audit-log-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">{copy.title}</CardTitle>
        <Link
          href={`/admin/tenants/${tenantId}/audit`}
          data-testid="audit-log-view-all"
          className="text-muted-foreground hover:text-foreground font-mono text-[11px] underline"
        >
          {copy.viewAll} →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">{copy.empty}</p>
        ) : (
          <ol className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                data-testid={`audit-event-${event.id}`}
                className="border-border/40 flex items-start gap-3 border-b pb-2 text-xs last:border-0"
              >
                <span aria-hidden className="text-base leading-none">
                  {ACTION_ICON[event.action]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{copy.actionLabels[event.action]}</p>
                  <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                    {event.performedByUserName ? `${copy.by} ${event.performedByUserName} · ` : ''}
                    {formatTimeAgo(event.createdAt, referenceMs, copy.ago)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function formatTimeAgo(iso: string, nowMs: number, agoLabel: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = nowMs - t;
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 1) return `< 1 min ${agoLabel}`;
  if (minutes < 60) return `${minutes} min ${agoLabel}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} u ${agoLabel}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ${agoLabel}`;
  return iso.slice(0, 10);
}
