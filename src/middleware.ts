import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { resolveTenant } from './lib/tenant/resolver';
import { TENANT_HEADER, TENANT_STRATEGY_HEADER } from './lib/tenant/context';

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  // 1) Resolve tenant from hostname + pathname (BEFORE i18n routing).
  const hostname = request.headers.get('host') ?? '';
  const pathname = request.nextUrl.pathname;
  const result = await resolveTenant({ hostname, pathname });

  // 2) Mutate the incoming request headers so downstream `headers()`
  //    calls in server components can read the tenant id.
  if (result.tenantId) {
    request.headers.set(TENANT_HEADER, result.tenantId);
  } else {
    request.headers.delete(TENANT_HEADER);
  }
  request.headers.set(TENANT_STRATEGY_HEADER, result.strategy);

  // 3) Hand off to the i18n middleware. It performs locale-aware
  //    rewriting; `/sites/<slug>` maps directly onto `[locale]/sites/[slug]`
  //    via `localePrefix: 'as-needed'`.
  const response = intlMiddleware(request);

  // 4) Mirror the tenant headers onto the outgoing response too — useful
  //    for inspecting from devtools and as a safety net for downstream
  //    runtimes that read response headers.
  if (result.tenantId) {
    response.headers.set(TENANT_HEADER, result.tenantId);
  }
  response.headers.set(TENANT_STRATEGY_HEADER, result.strategy);

  return response;
}

export const config = {
  // Skip API routes, Next internals, Vercel internals, dev-only routes
  // (design-system, debug), and anything that has a file extension
  // (static assets).
  matcher: ['/((?!api|_next|_vercel|design-system|debug|.*\\..*).*)'],
};
