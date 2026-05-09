import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, Vercel internals, design-system route,
  // and anything that has a file extension (static assets).
  matcher: ['/((?!api|_next|_vercel|design-system|.*\\..*).*)'],
};
