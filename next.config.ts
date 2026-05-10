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
};

export default withNextIntl(nextConfig);
