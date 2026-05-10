import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveBaseUrl } from '../base-url';

describe('resolveBaseUrl', () => {
  const original = {
    explicit: process.env.NEXT_PUBLIC_BASE_URL,
    vercelProd: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    vercelUrl: process.env.VERCEL_URL,
  };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    if (original.explicit) process.env.NEXT_PUBLIC_BASE_URL = original.explicit;
    if (original.vercelProd) process.env.VERCEL_PROJECT_PRODUCTION_URL = original.vercelProd;
    if (original.vercelUrl) process.env.VERCEL_URL = original.vercelUrl;
  });

  it('uses NEXT_PUBLIC_BASE_URL when set', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://framewise-pi.vercel.app';
    expect(resolveBaseUrl()).toBe('https://framewise-pi.vercel.app');
  });

  it('strips a trailing slash from NEXT_PUBLIC_BASE_URL', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com/';
    expect(resolveBaseUrl()).toBe('https://example.com');
  });

  it('falls back to VERCEL_PROJECT_PRODUCTION_URL with https prefix', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'framewise.example.com';
    expect(resolveBaseUrl()).toBe('https://framewise.example.com');
  });

  it('falls back to VERCEL_URL with https prefix', () => {
    process.env.VERCEL_URL = 'pr-42-framewise.vercel.app';
    expect(resolveBaseUrl()).toBe('https://pr-42-framewise.vercel.app');
  });

  it('falls back to localhost:3000 when nothing is set', () => {
    expect(resolveBaseUrl()).toBe('http://localhost:3000');
  });

  it('prefers NEXT_PUBLIC_BASE_URL over Vercel envs', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://custom.example.com';
    process.env.VERCEL_URL = 'fallback.vercel.app';
    expect(resolveBaseUrl()).toBe('https://custom.example.com');
  });
});
