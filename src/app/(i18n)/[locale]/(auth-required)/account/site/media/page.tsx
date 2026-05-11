import { notFound, redirect } from 'next/navigation';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DeleteButton } from '@/components/media/delete-button';
import { UploadButton } from '@/components/media/upload-button';
import { Card, CardContent } from '@/components/ui/card';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { mediaRepo, subscriptionsRepo } from '@/lib/data';
import { canEditBlocks } from '@/lib/permissions';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

const KB = 1024;
const MB = KB * 1024;

function formatSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`;
  return `${bytes} B`;
}

/**
 * Customer-facing media library (step 42, fase 12 part 4/8).
 * Pro / Enterprise customers can upload + soft-delete images
 * here; basic customers are redirected because the editor as a
 * whole isn't part of their plan.
 *
 * Soft-deleted items are filtered out by default — the
 * customer never sees them again, but image blocks that still
 * reference their URL keep rendering until they're moved to
 * something else.
 */
export default async function AccountSiteMediaPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const tenant = await getActiveTenantForUser();
  if (!tenant) notFound();

  const subscription = await subscriptionsRepo.findByTenant(tenant.id);
  const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;
  const editable = await canEditBlocks(user.id, tenant, plan?.code ?? null);
  if (!editable) redirect('/account');

  const items = await mediaRepo.listByTenant(tenant.id);
  const t = await getTranslations('account.siteMedia');

  return (
    <main
      data-testid="site-media-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16"
    >
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/account" className="text-muted-foreground font-mono text-xs hover:underline">
            ← {t('backToAccount')}
          </Link>
          <h1 className="text-display-md mt-1 font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2 text-sm">{t('subtitle')}</p>
        </div>
        <UploadButton copy={{ cta: t('upload'), uploading: t('uploading') }} />
      </header>

      {items.length === 0 ? (
        <Card data-testid="media-empty">
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <ul
          data-testid="media-grid"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
        >
          {items.map((item) => (
            <li key={item.id} data-testid={`media-item-${item.id}`}>
              <Card>
                <CardContent className="space-y-2 p-3">
                  <div className="bg-muted relative aspect-square overflow-hidden rounded-md">
                    {item.mime_type.startsWith('image/') ? (
                      <Image
                        src={item.public_url}
                        alt={item.alt_text.nl ?? item.alt_text.en ?? item.file_name}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                        {item.mime_type}
                      </div>
                    )}
                  </div>
                  <p className="truncate text-xs font-medium" title={item.file_name}>
                    {item.file_name}
                  </p>
                  <p className="text-muted-foreground font-mono text-[10px]">
                    {formatSize(item.size_bytes)}
                  </p>
                  <DeleteButton
                    mediaId={item.id}
                    copy={{ cta: t('delete'), confirm: t('confirmDelete') }}
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
