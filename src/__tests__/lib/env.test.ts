import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function resolveAlias(path: string): string {
  if (path.startsWith('@/')) {
    return resolve(__dirname, '../../../src', path.slice(2)); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- path is always a hardcoded string literal from test call sites, never user input
  }
  return path;
}

async function importFresh<T>(path: string): Promise<T> {
  vi.resetModules();
  return (await import(resolveAlias(path))) as T;
}

describe('env.client', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('parses valid public env vars', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    const mod =
      await importFresh<typeof import('@/lib/env.client')>('@/lib/env.client');
    expect(mod.clientEnv.NEXT_PUBLIC_SUPABASE_URL).toBe(
      'https://example.supabase.co',
    );
    expect(mod.clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('anon-key');
  });

  it('does NOT validate at import (lazy) — import succeeds even when invalid', async () => {
    // The whole point of the lazy design: importing the module must not throw,
    // so `next build` can bundle modules that touch env without the values
    // present. Validation is deferred to first property access (below).
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await expect(importFresh('@/lib/env.client')).resolves.toBeDefined();
  });

  it('throws on access when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    const mod =
      await importFresh<typeof import('@/lib/env.client')>('@/lib/env.client');
    expect(() => mod.clientEnv.NEXT_PUBLIC_SUPABASE_URL).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it('throws on access when NEXT_PUBLIC_SUPABASE_URL is not a url', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    const mod =
      await importFresh<typeof import('@/lib/env.client')>('@/lib/env.client');
    expect(() => mod.clientEnv.NEXT_PUBLIC_SUPABASE_URL).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it('trims surrounding whitespace from NEXT_PUBLIC_SUPABASE_URL', async () => {
    // A stray trailing space in the deployed value would otherwise corrupt
    // every `${url}/storage/...` image src and break Next's image optimizer.
    process.env.NEXT_PUBLIC_SUPABASE_URL = '  https://example.supabase.co  ';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    const mod =
      await importFresh<typeof import('@/lib/env.client')>('@/lib/env.client');
    expect(mod.clientEnv.NEXT_PUBLIC_SUPABASE_URL).toBe(
      'https://example.supabase.co',
    );
  });

  it('throws on access when NEXT_PUBLIC_SUPABASE_ANON_KEY is empty', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';

    const mod =
      await importFresh<typeof import('@/lib/env.client')>('@/lib/env.client');
    expect(() => mod.clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });
});

describe('env (server)', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('merges client and server env when valid', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const mod = await importFresh<typeof import('@/lib/env')>('@/lib/env');
    expect(mod.env).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      ADMIN_EMAIL: 'admin@example.com',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    });
  });

  it('does NOT validate at import (lazy) — import succeeds with ADMIN_EMAIL absent', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    delete process.env.ADMIN_EMAIL;

    // This is exactly the build-time condition on ProdStack: the public vars
    // arrive as build args, ADMIN_EMAIL does not. Import must not throw.
    await expect(importFresh('@/lib/env')).resolves.toBeDefined();
  });

  it('reads public vars without requiring ADMIN_EMAIL (decoupled validation)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    delete process.env.ADMIN_EMAIL;

    const mod = await importFresh<typeof import('@/lib/env')>('@/lib/env');
    // A static page reading only the public vars (e.g. the Supabase server
    // client at build) must not trip the server-secret validation.
    expect(mod.env.NEXT_PUBLIC_SUPABASE_URL).toBe(
      'https://example.supabase.co',
    );
    expect(() => mod.env.ADMIN_EMAIL).toThrow(/ADMIN_EMAIL/);
  });

  it('throws on access when ADMIN_EMAIL is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    delete process.env.ADMIN_EMAIL;

    const mod = await importFresh<typeof import('@/lib/env')>('@/lib/env');
    expect(() => mod.env.ADMIN_EMAIL).toThrow(/ADMIN_EMAIL/);
  });

  it('throws on access when ADMIN_EMAIL is not an email', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.ADMIN_EMAIL = 'not-an-email';

    const mod = await importFresh<typeof import('@/lib/env')>('@/lib/env');
    expect(() => mod.env.ADMIN_EMAIL).toThrow(/ADMIN_EMAIL/);
  });

  it('throws on access when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const mod = await importFresh<typeof import('@/lib/env')>('@/lib/env');
    expect(() => mod.env.SUPABASE_SERVICE_ROLE_KEY).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it('throws on access when SUPABASE_SERVICE_ROLE_KEY is empty', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';

    const mod = await importFresh<typeof import('@/lib/env')>('@/lib/env');
    expect(() => mod.env.SUPABASE_SERVICE_ROLE_KEY).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });
});
