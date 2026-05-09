import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/routing';

const HOST = 'https://framewise-pi.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // For each public route, emit one entry per locale with hreflang alternates.
  const routes = ['/'];

  return routes.flatMap((route) => {
    const languages = Object.fromEntries(
      locales.map((locale) => [locale, `${HOST}${locale === 'nl' ? '' : `/${locale}`}${route}`])
    );

    return locales.map((locale) => ({
      url: `${HOST}${locale === 'nl' ? '' : `/${locale}`}${route}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: locale === 'nl' ? 1.0 : 0.9,
      alternates: { languages },
    }));
  });
}
