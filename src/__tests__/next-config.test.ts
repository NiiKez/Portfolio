import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextConfig } from 'next';

const ORIGINAL_ENV = { ...process.env };

type ConfigModule = { default: NextConfig };

async function importConfig(): Promise<NextConfig> {
  vi.resetModules();
  const mod = (await import('../../next.config')) as ConfigModule;
  return mod.default;
}

// NOTE: Content-Security-Policy is no longer set here — it carries a per-request
// nonce and is built in `src/middleware.ts`. Its coverage lives in
// `src/__tests__/lib/csp.test.ts` and `src/__tests__/middleware.test.ts`.
describe('next.config security headers', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns the request-invariant security headers with the expected values', async () => {
    const config = await importConfig();
    const ruleSets = await config.headers!();

    expect(ruleSets).toHaveLength(1);
    expect(ruleSets[0]!.source).toBe('/(.*)');

    const byKey = Object.fromEntries(
      ruleSets[0]!.headers.map((h) => [h.key, h.value]),
    );

    // CSP is set per-request in the middleware, never here.
    expect(byKey['Content-Security-Policy']).toBeUndefined();
    expect(byKey['Strict-Transport-Security']).toBe(
      'max-age=63072000; includeSubDomains',
    );
    expect(byKey['X-Content-Type-Options']).toBe('nosniff');
    expect(byKey['X-Frame-Options']).toBe('DENY');
    expect(byKey['X-XSS-Protection']).toBe('1; mode=block');
    expect(byKey['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(byKey['Permissions-Policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=(), browsing-topics=()',
    );
  });

  it('denies the high-risk powerful features in Permissions-Policy', async () => {
    const config = await importConfig();
    const ruleSets = await config.headers!();
    const byKey = Object.fromEntries(
      ruleSets[0]!.headers.map((h) => [h.key, h.value]),
    );
    const policy = byKey['Permissions-Policy']!;

    // Deny-by-default for features the site never uses — a regression that drops
    // any of these (re-opening payment/usb/serial/bluetooth or the Topics API to
    // injected scripts) must fail here.
    for (const feature of [
      'camera',
      'microphone',
      'geolocation',
      'payment',
      'usb',
      'serial',
      'bluetooth',
      'interest-cohort',
      'browsing-topics',
    ]) {
      expect(policy).toContain(`${feature}=()`);
    }
  });
});

describe('next.config redirects', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('permanently redirects /skills to /about', async () => {
    const config = await importConfig();
    const redirects = await config.redirects!();

    expect(redirects).toEqual([
      { source: '/skills', destination: '/about', permanent: true },
    ]);
  });
});
