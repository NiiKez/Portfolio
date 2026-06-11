import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getBaseUrl } from '@/lib/site-url';

// getBaseUrl reads process.env at call time (not module load), so each case can
// set the relevant vars and restore them afterwards. Restoring matters because
// the global setup may define NEXT_PUBLIC_SITE_URL and other suites rely on it.
describe('getBaseUrl', () => {
  const ORIGINAL = {
    site: process.env.NEXT_PUBLIC_SITE_URL,
  };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (ORIGINAL.site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL.site;
  });

  it('uses an explicit NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portfolio.example';
    expect(getBaseUrl()).toBe('https://portfolio.example');
  });

  it('falls back to localhost when SITE_URL is unset (non-production)', () => {
    expect(getBaseUrl()).toBe('http://localhost:3000');
  });

  it('throws in production instead of silently falling back to localhost', () => {
    // A localhost fallback in prod would poison OG/canonical/sitemap/robots and
    // the magic-link redirect_to — fail loud instead.
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => getBaseUrl()).toThrow(/NEXT_PUBLIC_SITE_URL must be set/);
  });

  it('treats a blank NEXT_PUBLIC_SITE_URL as unset (non-production)', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '   ';
    expect(getBaseUrl()).toBe('http://localhost:3000');
  });
});
