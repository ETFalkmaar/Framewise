import type { MetadataRoute } from 'next';

const HOST = 'https://framewise-pi.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/design-system'],
    },
    sitemap: `${HOST}/sitemap.xml`,
  };
}
