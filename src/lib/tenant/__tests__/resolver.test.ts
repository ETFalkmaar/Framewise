import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveTenant } from '@/lib/tenant';
import { resolveByCustomDomain } from '@/lib/tenant/strategies/custom-domain';
import { resolveBySubdomain } from '@/lib/tenant/strategies/subdomain';
import { resolveByPathPrefix } from '@/lib/tenant/strategies/path-prefix';
import { resetStore } from '@/lib/data';

const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('strategy: resolveByCustomDomain', () => {
  it('matches a tenant whose custom_domain equals the hostname', async () => {
    const result = await resolveByCustomDomain({
      hostname: 'villa-bonbini.com',
      pathname: '/',
    });
    expect(result).not.toBeNull();
    expect(result!.strategy).toBe('custom-domain');
    expect(result!.tenantId).toBe(VILLA_ID);
  });

  it('skips Framewise root hosts', async () => {
    expect(
      await resolveByCustomDomain({
        hostname: 'framewise-pi.vercel.app',
        pathname: '/',
      })
    ).toBeNull();
  });

  it('skips *.vercel.app', async () => {
    expect(
      await resolveByCustomDomain({
        hostname: 'framewise-abc123-etfalkmaars-projects.vercel.app',
        pathname: '/',
      })
    ).toBeNull();
  });

  it('skips localhost variants', async () => {
    expect(await resolveByCustomDomain({ hostname: 'localhost', pathname: '/' })).toBeNull();
    expect(await resolveByCustomDomain({ hostname: 'demo.localhost', pathname: '/' })).toBeNull();
  });

  it('strips port numbers before matching', async () => {
    const result = await resolveByCustomDomain({
      hostname: 'villa-bonbini.com:443',
      pathname: '/',
    });
    expect(result?.tenantId).toBe(VILLA_ID);
  });

  it('returns null when the domain is not bound', async () => {
    expect(
      await resolveByCustomDomain({
        hostname: 'never-seen.example.com',
        pathname: '/',
      })
    ).toBeNull();
  });
});

describe('strategy: resolveBySubdomain', () => {
  it('matches <slug>.framewise.app', async () => {
    const result = await resolveBySubdomain({
      hostname: 'demo-villa.framewise.app',
      pathname: '/',
    });
    expect(result?.tenantId).toBe(VILLA_ID);
    expect(result?.strategy).toBe('subdomain');
    expect(result?.matchedSlug).toBe('demo-villa');
  });

  it('matches <slug>.framewise-pi.vercel.app', async () => {
    const result = await resolveBySubdomain({
      hostname: 'demo-restaurant.framewise-pi.vercel.app',
      pathname: '/',
    });
    expect(result?.tenantId).toBe(RESTAURANT_ID);
  });

  it('matches <slug>.localhost (dev)', async () => {
    const result = await resolveBySubdomain({
      hostname: 'demo-villa.localhost',
      pathname: '/',
    });
    expect(result?.tenantId).toBe(VILLA_ID);
  });

  it('skips multi-level subdomains', async () => {
    expect(
      await resolveBySubdomain({
        hostname: 'a.b.framewise.app',
        pathname: '/',
      })
    ).toBeNull();
  });

  it('skips reserved subdomains (www, admin, api)', async () => {
    for (const reserved of ['www', 'admin', 'api']) {
      expect(
        await resolveBySubdomain({
          hostname: `${reserved}.framewise.app`,
          pathname: '/',
        })
      ).toBeNull();
    }
  });

  it('returns null on the bare root host', async () => {
    expect(await resolveBySubdomain({ hostname: 'framewise.app', pathname: '/' })).toBeNull();
  });
});

describe('strategy: resolveByPathPrefix', () => {
  it('extracts slug and residual path', async () => {
    const result = await resolveByPathPrefix({
      hostname: 'framewise-pi.vercel.app',
      pathname: '/sites/demo-villa/about',
    });
    expect(result?.tenantId).toBe(VILLA_ID);
    expect(result?.strategy).toBe('path-prefix');
    expect(result?.matchedSlug).toBe('demo-villa');
    expect(result?.residualPath).toBe('/about');
  });

  it('handles bare /sites/<slug> (no residual)', async () => {
    const result = await resolveByPathPrefix({
      hostname: 'framewise-pi.vercel.app',
      pathname: '/sites/demo-villa',
    });
    expect(result?.tenantId).toBe(VILLA_ID);
    expect(result?.residualPath).toBe('/');
  });

  it('handles localised /<locale>/sites/<slug>', async () => {
    const result = await resolveByPathPrefix({
      hostname: 'framewise-pi.vercel.app',
      pathname: '/fr/sites/demo-restaurant/over-ons',
    });
    expect(result?.tenantId).toBe(RESTAURANT_ID);
    expect(result?.residualPath).toBe('/over-ons');
  });

  it('returns null when the slug is unknown', async () => {
    expect(
      await resolveByPathPrefix({
        hostname: 'framewise-pi.vercel.app',
        pathname: '/sites/nonexistent',
      })
    ).toBeNull();
  });

  it('returns null when the path does not start with /sites', async () => {
    expect(
      await resolveByPathPrefix({
        hostname: 'framewise-pi.vercel.app',
        pathname: '/about',
      })
    ).toBeNull();
  });
});

describe('orchestrator: resolveTenant priority order', () => {
  it('prefers custom-domain over the rest', async () => {
    const result = await resolveTenant({
      hostname: 'villa-bonbini.com',
      pathname: '/sites/demo-restaurant',
    });
    expect(result.strategy).toBe('custom-domain');
    expect(result.tenantId).toBe(VILLA_ID);
  });

  it('falls back to subdomain when custom-domain misses', async () => {
    const result = await resolveTenant({
      hostname: 'demo-villa.framewise.app',
      pathname: '/',
    });
    expect(result.strategy).toBe('subdomain');
    expect(result.tenantId).toBe(VILLA_ID);
  });

  it('falls back to path-prefix when host is the bare root', async () => {
    const result = await resolveTenant({
      hostname: 'framewise-pi.vercel.app',
      pathname: '/sites/demo-villa/contact',
    });
    expect(result.strategy).toBe('path-prefix');
    expect(result.tenantId).toBe(VILLA_ID);
    expect(result.residualPath).toBe('/contact');
  });

  it('returns no tenant for the marketing root', async () => {
    const result = await resolveTenant({
      hostname: 'framewise-pi.vercel.app',
      pathname: '/',
    });
    expect(result.strategy).toBe('none');
    expect(result.tenantId).toBeNull();
  });

  it('handles empty hostname gracefully', async () => {
    const result = await resolveTenant({ hostname: '', pathname: '/' });
    expect(result.strategy).toBe('none');
    expect(result.tenantId).toBeNull();
  });
});
