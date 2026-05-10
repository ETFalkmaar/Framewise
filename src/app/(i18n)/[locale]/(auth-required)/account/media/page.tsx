import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { mediaRepo, usersRepo } from '@/lib/data';
import { getActiveTenantForUser } from '@/lib/auth';
import { getActiveProvider } from '@/lib/storage';
import type { Media, User } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const KB = 1024;
const MB = KB * 1024;

function formatSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default async function MediaLibraryPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('account.media');
  const tAccount = await getTranslations('account');

  const tenant = await getActiveTenantForUser();
  if (!tenant) {
    return (
      <main
        data-testid="media-page"
        className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-md flex-col px-6 py-24"
      >
        <header className="mb-10">
          <Badge variant="outline" className="font-mono">
            /account/media
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">{t('title')}</h1>
        </header>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">{t('noTenant')}</CardTitle>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const [media, users] = await Promise.all([mediaRepo.listByTenant(tenant.id), usersRepo.list()]);
  const userMap = new Map<string, User>(users.map((u) => [u.id, u]));
  const provider = getActiveProvider();

  return (
    <main
      data-testid="media-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-xl flex-col px-6 py-16"
    >
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline" className="font-mono">
            /account/media
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <Badge variant="secondary" data-testid="storage-provider-badge">
            {t('storageBadge')}: {provider.name}
          </Badge>
          <Badge variant="outline">{tenant.name}</Badge>
          <button
            type="button"
            disabled
            aria-disabled
            data-testid="upload-button"
            title={t('uploadDisabled')}
            className="ring-border bg-background cursor-not-allowed rounded-md px-2 py-1 opacity-60 ring-1"
          >
            ↑ {t('uploadButton')}
          </button>
        </div>
      </header>

      {media.length === 0 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">{t('empty')}</CardTitle>
            <CardDescription className="text-xs">{t('emptyHint')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div
          data-testid="media-grid"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {media.map((m) => (
            <MediaCard
              key={m.id}
              media={m}
              uploader={userMap.get(m.uploaded_by_user_id)}
              locale={locale}
            />
          ))}
        </div>
      )}

      <Separator className="my-12" />
      <p className="text-muted-foreground font-mono text-xs">
        <Link href="/account" className="hover:text-foreground underline">
          ← {tAccount('title')}
        </Link>
      </p>
    </main>
  );
}

function MediaCard({
  media,
  uploader,
  locale,
}: {
  media: Media;
  uploader: User | undefined;
  locale: Locale;
}) {
  const isImage = media.mime_type.startsWith('image/');
  const altText = media.alt_text[locale] || media.alt_text.en || media.file_name;
  const date = media.created_at.slice(0, 10);

  return (
    <Card size="sm" data-testid={`media-card-${media.id}`} className="h-full overflow-hidden">
      <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
        {isImage ? (
          <Image
            src={media.public_url}
            alt={altText}
            fill
            sizes="(min-width: 1280px) 240px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center font-mono text-xs">
            {media.mime_type}
          </div>
        )}
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="truncate font-mono text-xs" title={media.file_name}>
          {media.file_name}
        </CardTitle>
        <CardDescription className="font-mono text-[11px]">
          {media.mime_type} · {formatSize(media.size_bytes)}
          {media.width && media.height ? ` · ${media.width}×${media.height}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-1 text-[11px]">
        <p className="line-clamp-2 italic">{altText}</p>
        <p className="font-mono">
          {date}
          {uploader ? ` · ${uploader.email}` : ''}
        </p>
      </CardContent>
    </Card>
  );
}
