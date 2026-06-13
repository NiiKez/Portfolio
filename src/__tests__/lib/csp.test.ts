import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildCsp, generateNonce } from '@/lib/csp';

const ORIGINAL_ENV = { ...process.env };

function directive(csp: string, name: string): string | undefined {
  return csp.split('; ').find((d) => d.startsWith(`${name} `) || d === name);
}

describe('generateNonce', () => {
  it('produces a non-empty base64 string', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(nonce.length).toBeGreaterThan(0);
  });

  it('produces a different value each call', () => {
    expect(generateNonce()).not.toBe(generateNonce());
  });
});

describe('buildCsp', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SUPABASE_URL: 'https://proj.supabase.co',
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('puts the nonce in script-src and never uses unsafe-inline for scripts', () => {
    process.env.NODE_ENV = 'production';
    const csp = buildCsp('NONCE123');
    const scriptSrc = directive(csp, 'script-src')!;

    expect(scriptSrc).toContain("'nonce-NONCE123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("does not allow 'unsafe-eval' in production", () => {
    process.env.NODE_ENV = 'production';
    const scriptSrc = directive(buildCsp('n'), 'script-src')!;
    expect(scriptSrc).not.toContain('unsafe-eval');
  });

  it("allows 'unsafe-eval' in development (for Fast Refresh)", () => {
    process.env.NODE_ENV = 'development';
    const scriptSrc = directive(buildCsp('n'), 'script-src')!;
    expect(scriptSrc).toContain("'unsafe-eval'");
  });

  it('locks down framing, objects, base-uri, form-action and default-src', () => {
    const csp = buildCsp('n');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('pins img/media/connect sources to the configured Supabase host', () => {
    const csp = buildCsp('n');
    expect(directive(csp, 'img-src')).toContain('https://proj.supabase.co');
    expect(directive(csp, 'media-src')).toContain('https://proj.supabase.co');
    expect(directive(csp, 'connect-src')).toContain('https://proj.supabase.co');
    expect(directive(csp, 'connect-src')).toContain('wss://proj.supabase.co');
  });

  it('keeps unsafe-inline for styles only (Tailwind / inline style props)', () => {
    const styleSrc = directive(buildCsp('n'), 'style-src')!;
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it('falls back to the *.supabase.co wildcard when the URL is unset', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const csp = buildCsp('n');
    expect(directive(csp, 'connect-src')).toContain('https://*.supabase.co');
    expect(directive(csp, 'img-src')).toContain('https://*.supabase.co');
  });
});
