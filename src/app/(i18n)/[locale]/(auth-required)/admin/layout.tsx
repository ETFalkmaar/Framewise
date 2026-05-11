import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AdminHeader } from '@/components/admin/switcher/admin-header';
import {
  RECENT_TENANTS_COOKIE,
  hydrateRecentTenants,
  parseRecentTenantsCookie,
  type SearchResultType,
} from '@/lib/admin';
import { getCurrentUser, isUserSuperAdmin } from '@/lib/auth';
import { tenantsRepo } from '@/lib/data';

/**
 * Persistent super-admin shell (step 38, fase 11 part 4/4).
 *
 * Wraps every `/admin/*` route with the global header — Cmd+K
 * search trigger on the left, tenant switcher on the right.
 * Non-super-admins are redirected to `/account` here so per-
 * route guards stay simple. The cookie-backed "recent tenants"
 * list is read once per request and hydrated for the switcher.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isUserSuperAdmin(user.id)) redirect('/account');

  const cookieStore = await cookies();
  const recentIds = parseRecentTenantsCookie(cookieStore.get(RECENT_TENANTS_COOKIE)?.value);

  const [recentTenants, allTenants] = await Promise.all([
    hydrateRecentTenants(recentIds),
    tenantsRepo.list(),
  ]);

  const tSwitcher = await getTranslations('admin.switcher');
  const tSearch = await getTranslations('admin.search');
  const tSearchCategories = await getTranslations('admin.search.categories');

  const categories: Record<SearchResultType, string> = {
    tenant: tSearchCategories('tenant'),
    site: tSearchCategories('site'),
    connection: tSearchCategories('connection'),
  };

  return (
    <>
      <AdminHeader
        currentTenantId={null}
        recentTenants={recentTenants}
        allTenants={allTenants}
        copy={{
          brand: 'Super-admin',
          switcher: {
            selectClient: tSwitcher('selectClient'),
            searchPlaceholder: tSwitcher('searchPlaceholder'),
            recent: tSwitcher('recent'),
            allTenants: tSwitcher('allTenants'),
            noResults: tSwitcher('noResults'),
          },
          search: {
            trigger: tSearch('trigger'),
            shortcut: tSearch('shortcut'),
            placeholder: tSearch('placeholder'),
            noResults: tSearch('noResults'),
            categories,
          },
        }}
      />
      {children}
    </>
  );
}
