import { describe, expect, it } from 'vitest';
import { ROBOTS_DISALLOW_PATHS, buildRobots } from '../robots-builder';

describe('buildRobots', () => {
  const BASE_URL = 'https://framewise-pi.vercel.app';

  it('uses User-agent: * by default', () => {
    const robots = buildRobots({ baseUrl: BASE_URL });
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    expect(rule?.userAgent).toBe('*');
  });

  it('allows the root path', () => {
    const robots = buildRobots({ baseUrl: BASE_URL });
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    expect(rule?.allow).toBe('/');
  });

  it('disallows /account/, /api/, /debug/, /login', () => {
    const robots = buildRobots({ baseUrl: BASE_URL });
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    expect(rule?.disallow).toEqual(['/account/', '/api/', '/debug/', '/login']);
  });

  it('exports the disallow list as a stable constant', () => {
    expect(ROBOTS_DISALLOW_PATHS).toEqual(['/account/', '/api/', '/debug/', '/login']);
  });

  it('emits a Sitemap line by default', () => {
    const robots = buildRobots({ baseUrl: BASE_URL });
    expect(robots.sitemap).toBe(`${BASE_URL}/sitemap.xml`);
  });

  it('omits the Sitemap line when includeSitemap is false', () => {
    const robots = buildRobots({ baseUrl: BASE_URL, includeSitemap: false });
    expect(robots.sitemap).toBeUndefined();
  });

  it('still emits a Sitemap line when includeSitemap is explicitly true', () => {
    const robots = buildRobots({ baseUrl: BASE_URL, includeSitemap: true });
    expect(robots.sitemap).toBe(`${BASE_URL}/sitemap.xml`);
  });

  it('strips a trailing slash from the base URL before composing the sitemap URL', () => {
    const robots = buildRobots({ baseUrl: `${BASE_URL}/` });
    expect(robots.sitemap).toBe(`${BASE_URL}/sitemap.xml`);
    expect(robots.host).toBe(BASE_URL);
  });

  it('reports the base URL as host', () => {
    const robots = buildRobots({ baseUrl: BASE_URL });
    expect(robots.host).toBe(BASE_URL);
  });
});
