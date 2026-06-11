import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextConfig } from 'next';

const ORIGINAL_ENV = { ...process.env };

type ConfigModule = { default: NextConfig };

async function importConfig(): Promise<NextConfig> {
  vi.resetModules();
  const mod = (await import('../../next.config')) as ConfigModule;
  return mod.default;
}

async function getCsp(config: NextConfig): Promise<string> {
  const headers = await config.headers!();
  const all = headers[0]!.headers;
  const csp = all.find((h) => h.key === 'Content-Security-Policy');
  return csp!.value;
}

describe('next.config headers - CSP', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("does not allow 'unsafe-eval' in production", async () => {
    process.env = { ...process.env, NODE_ENV: 'production' };
    const config = await importConfig();
    const csp = await getCsp(config);

    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain('unsafe-eval');
  });

  it("allows 'unsafe-eval' in development", async () => {
    process.env = { ...process.env, NODE_ENV: 'development' };
    const config = await importConfig();
    const csp = await getCsp(config);

    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toContain("'unsafe-eval'");
  });

  it('always locks down framing and object/default sources', async () => {
    process.env = { ...process.env, NODE_ENV: 'production' };
    const config = await importConfig();
    const csp = await getCsp(config);

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
  });
});

describe('next.config security headers', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns all six security headers with the expected values', async () => {
    const config = await importConfig();
    const ruleSets = await config.headers!();

    expect(ruleSets).toHaveLength(1);
    expect(ruleSets[0]!.source).toBe('/(.*)');

    const byKey = Object.fromEntries(
      ruleSets[0]!.headers.map((h) => [h.key, h.value]),
    );

    expect(byKey['Content-Security-Policy']).toBeDefined();
    expect(byKey['X-Content-Type-Options']).toBe('nosniff');
    expect(byKey['X-Frame-Options']).toBe('DENY');
    expect(byKey['X-XSS-Protection']).toBe('1; mode=block');
    expect(byKey['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(byKey['Permissions-Policy']).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
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
