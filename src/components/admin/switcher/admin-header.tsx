import { NotificationBell, type NotificationBellCopy } from '@/components/admin/notification-bell';
import { Link } from '@/i18n/navigation';
import type { SearchResultType } from '@/lib/admin';
import type { Notification, Tenant } from '@/types/database';

import { GlobalSearchBar } from './global-search-bar';
import { TenantSwitcher } from './tenant-switcher';

interface HeaderCopy {
  brand: string;
  switcher: {
    selectClient: string;
    searchPlaceholder: string;
    recent: string;
    allTenants: string;
    noResults: string;
  };
  search: {
    trigger: string;
    shortcut: string;
    placeholder: string;
    noResults: string;
    categories: Record<SearchResultType, string>;
  };
  notifications: NotificationBellCopy;
}

export interface AdminHeaderProps {
  currentTenantId: string | null;
  recentTenants: Tenant[];
  allTenants: Tenant[];
  /** Step 48 — pre-loaded by the admin layout for the bell dropdown. */
  unreadNotifications: number;
  recentNotifications: Notification[];
  copy: HeaderCopy;
}

/**
 * Persistent super-admin nav bar — visible on every /admin
 * route via the admin layout (step 38). Renders the brand on
 * the left, then the global Cmd+K search trigger and the
 * tenant switcher on the right.
 */
export function AdminHeader({
  currentTenantId,
  recentTenants,
  allTenants,
  unreadNotifications,
  recentNotifications,
  copy,
}: AdminHeaderProps) {
  return (
    <header
      data-testid="admin-header"
      className="border-border/40 bg-background/95 sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-6 py-3 backdrop-blur"
    >
      <div className="flex items-center gap-4">
        <Link href="/admin/tenants" className="font-mono text-xs tracking-wide uppercase">
          <span className="text-muted-foreground">Framewise</span> · {copy.brand}
        </Link>
        <Link
          href="/admin/bookings"
          data-testid="admin-nav-bookings"
          className="text-muted-foreground hover:text-foreground font-mono text-xs tracking-wide uppercase"
        >
          Bookings
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <GlobalSearchBar copy={copy.search} />
        <NotificationBell
          unreadCount={unreadNotifications}
          recent={recentNotifications}
          copy={copy.notifications}
        />
        <TenantSwitcher
          currentTenantId={currentTenantId}
          recentTenants={recentTenants}
          allTenants={allTenants}
          copy={copy.switcher}
        />
      </div>
    </header>
  );
}
