import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    // Mock storage provider returns Picsum / placeholder URLs;
    // Vercel Blob serves from public.blob.vercel-storage.com.
    // Step 119 will swap the Vercel host for Supabase Storage.
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },

  /**
   * Step 29: cache headers for the public renderer.
   *
   * Static asset extensions get a year-long immutable cache — they
   * carry a content hash in the URL via Next's image / asset
   * pipeline so a new deploy invalidates them by emitting a new
   * filename.
   *
   * Public tenant pages get a 60-second shared cache plus
   * `stale-while-revalidate` so a user request always hits a warm
   * edge while ISR refreshes in the background. The window matches
   * `ISR_REVALIDATE.PUBLIC_PAGE` in `src/lib/perf/isr-config.ts`.
   */
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|gif|ico|woff|woff2)',
        locale: false,
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/sites/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
    ];
  },

  experimental: {
    /**
     * `lucide-react` ships every icon as a separate module. Without
     * this hint Next bundles each barrel re-export, which inflates
     * the public route's JS by tens of KB per page.
     */
    optimizePackageImports: ['lucide-react'],
  },
};

export default withNextIntl(nextConfig);
