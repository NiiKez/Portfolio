import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '@/middleware';

const mockEnv = vi.hoisted(() => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    ADMIN_EMAIL: 'admin@example.com',
    SITE_PASSWORD: undefined as string | undefined,
  },
}));

vi.mock('@/lib/env', () => mockEnv);

const updateSession = vi.fn();

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: (...args: unknown[]) => updateSession(...args),
}));

import { middleware } from '@/middleware';

type FakeUser = { email: string } | null;

function mockSession(user: FakeUser) {
  const response = NextResponse.next();
  updateSession.mockResolvedValue({ response, user });
  return response;
}

function requestFor(path: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(`http://localhost:3000${path}`), { headers });
}

function basicAuth(user: string, password: string) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.env.SITE_PASSWORD = undefined;
});

describe('middleware', () => {
  it('redirects an unauthenticated user away from an admin route to /admin/login', async () => {
    mockSession(null);

    const result = await middleware(
      requestFor('/admin/projects?next=https://evil.example/steal'),
    );

    expect(result.status).toBe(307);
    const location = new URL(result.headers.get('location') as string);
    expect(location.host).toBe('localhost:3000');
    expect(location.pathname).toBe('/admin/login');
    // The original query string is dropped on redirect (middleware sets
    // `url.search = ''`) so an attacker-supplied `?next=` (or any reflected
    // param) cannot ride along to the login page. Deleting that line in the
    // source must fail this test.
    expect(location.search).toBe('');
    expect(result.headers.get('location')).not.toContain('evil.example');
  });

  it('redirects a non-admin user away from an admin route to /admin/login', async () => {
    mockSession({ email: 'someone@else.com' });

    const result = await middleware(requestFor('/admin/projects'));

    expect(result.status).toBe(307);
    const location = new URL(result.headers.get('location') as string);
    expect(location.host).toBe('localhost:3000');
    expect(location.pathname).toBe('/admin/login');
  });

  it('redirects an unauthenticated user away from the bare /admin route to /admin/login', async () => {
    mockSession(null);

    const result = await middleware(requestFor('/admin'));

    expect(result.status).toBe(307);
    const location = new URL(result.headers.get('location') as string);
    expect(location.host).toBe('localhost:3000');
    expect(location.pathname).toBe('/admin/login');
  });

  it('redirects an unauthenticated user away from a deeply nested admin route to /admin/login', async () => {
    mockSession(null);

    const result = await middleware(requestFor('/admin/projects/123/edit'));

    expect(result.status).toBe(307);
    const location = new URL(result.headers.get('location') as string);
    expect(location.host).toBe('localhost:3000');
    expect(location.pathname).toBe('/admin/login');
  });

  it('still gates /admin/loginx for a non-admin (login exemption is an exact match, not a prefix)', async () => {
    // `/admin/loginx` starts with `/admin/login` but is NOT the login route. The
    // gate uses `pathname === '/admin/login'`, so a loose prefix match here would
    // wrongly expose any `/admin/login*` path — assert it is still redirected.
    mockSession({ email: 'someone@else.com' });

    const result = await middleware(requestFor('/admin/loginx'));

    expect(result.status).toBe(307);
    const location = new URL(result.headers.get('location') as string);
    expect(location.host).toBe('localhost:3000');
    expect(location.pathname).toBe('/admin/login');
  });

  it('lets the admin user pass through to an admin route', async () => {
    const response = mockSession({ email: 'admin@example.com' });

    const result = await middleware(requestFor('/admin/projects'));

    expect(result).toBe(response);
    expect(result.headers.get('location')).toBeNull();
    // The admin pass-through returns the updateSession response directly; assert
    // the per-request CSP is still attached to it (admin pages must not ship
    // without the nonce CSP if the source ever early-returns before setting it).
    expect(result.headers.get('content-security-policy')).toMatch(
      /script-src[^;]*'nonce-[A-Za-z0-9+/=]+'/,
    );
  });

  it('redirects an already-authenticated admin away from the login route to /admin', async () => {
    mockSession({ email: 'admin@example.com' });

    const result = await middleware(
      requestFor('/admin/login?next=https://evil.example'),
    );

    expect(result.status).toBe(307);
    const location = new URL(result.headers.get('location') as string);
    expect(location.host).toBe('localhost:3000');
    expect(location.pathname).toBe('/admin');
    // Same query-strip guard on the login→/admin bounce.
    expect(location.search).toBe('');
    expect(result.headers.get('location')).not.toContain('evil.example');
  });

  it('lets an unauthenticated user reach the login route', async () => {
    const response = mockSession(null);

    const result = await middleware(requestFor('/admin/login'));

    expect(result).toBe(response);
    expect(result.headers.get('location')).toBeNull();
  });

  it('lets an unauthenticated user reach a public route', async () => {
    const response = mockSession(null);

    expect(await middleware(requestFor('/'))).toBe(response);
    expect(await middleware(requestFor('/projects'))).toBe(response);
  });
});

describe('CSP nonce', () => {
  it('sets a nonce-based Content-Security-Policy on the response', async () => {
    mockSession(null);

    const result = await middleware(requestFor('/'));

    const csp = result.headers.get('content-security-policy');
    expect(csp).toBeTruthy();
    const scriptSrc = csp!.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    // The whole point of the migration: no inline-script escape hatch.
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('forwards the same nonce to updateSession via the x-nonce request header', async () => {
    mockSession(null);

    const result = await middleware(requestFor('/'));

    const csp = result.headers.get('content-security-policy')!;
    const nonce = csp.match(/'nonce-([A-Za-z0-9+/=]+)'/)![1];

    const extraHeaders = updateSession.mock.calls[0]![1] as Record<
      string,
      string
    >;
    expect(extraHeaders['x-nonce']).toBe(nonce);
    expect(extraHeaders['Content-Security-Policy']).toBe(csp);
  });

  it('uses a fresh nonce on every request', async () => {
    // A new response per call so each carries its own CSP header (the shared
    // mockSession response would otherwise be mutated twice and compare equal).
    updateSession.mockImplementation(async () => ({
      response: NextResponse.next(),
      user: null,
    }));

    const first = await middleware(requestFor('/'));
    const second = await middleware(requestFor('/'));

    expect(first.headers.get('content-security-policy')).not.toBe(
      second.headers.get('content-security-policy'),
    );
  });

  it('does not set a CSP on the site-password 401 challenge', async () => {
    mockEnv.env.SITE_PASSWORD = 'sekret';
    mockSession(null);

    const result = await middleware(requestFor('/'));

    expect(result.status).toBe(401);
    expect(result.headers.get('content-security-policy')).toBeNull();
  });
});

describe('site password gate', () => {
  it('does not gate any route when SITE_PASSWORD is unset', async () => {
    const response = mockSession(null);

    expect(await middleware(requestFor('/'))).toBe(response);
    expect(updateSession).toHaveBeenCalled();
  });

  it('challenges a request with no credentials when SITE_PASSWORD is set', async () => {
    mockEnv.env.SITE_PASSWORD = 'sekret';
    mockSession(null);

    const result = await middleware(requestFor('/'));

    expect(result.status).toBe(401);
    expect(result.headers.get('www-authenticate')).toContain('Basic');
    // The gate short-circuits before any Supabase session work.
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('challenges a request with the wrong password', async () => {
    mockEnv.env.SITE_PASSWORD = 'sekret';
    mockSession(null);

    const result = await middleware(
      requestFor('/', { authorization: basicAuth('admin', 'nope') }),
    );

    expect(result.status).toBe(401);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('lets a request through with the correct credentials', async () => {
    mockEnv.env.SITE_PASSWORD = 'sekret';
    const response = mockSession(null);

    const result = await middleware(
      requestFor('/', { authorization: basicAuth('admin', 'sekret') }),
    );

    expect(result).toBe(response);
    expect(updateSession).toHaveBeenCalled();
  });

  it('exempts the /auth/* magic-link routes from the gate', async () => {
    mockEnv.env.SITE_PASSWORD = 'sekret';
    const response = mockSession(null);

    const result = await middleware(requestFor('/auth/callback?code=abc'));

    expect(result).toBe(response);
    expect(updateSession).toHaveBeenCalled();
  });

  it('still enforces admin auth once past the gate', async () => {
    mockEnv.env.SITE_PASSWORD = 'sekret';
    mockSession(null);

    const result = await middleware(
      requestFor('/admin/projects', {
        authorization: basicAuth('admin', 'sekret'),
      }),
    );

    // Passed the Basic gate, but the Supabase admin check still redirects.
    expect(result.status).toBe(307);
    expect(new URL(result.headers.get('location') as string).pathname).toBe(
      '/admin/login',
    );
  });
});

describe('config.matcher', () => {
  // Next compiles `config.matcher` with path-to-regexp, not the bare RegExp
  // constructor, so `new RegExp(config.matcher[0])` is only an APPROXIMATION of
  // the real route filter. Next anchors the compiled matcher to the whole path,
  // so we anchor with `^…$` to mirror that (an un-anchored `new RegExp` would let
  // the negative lookahead be skipped at a later offset and wrongly "match"
  // `/_next/static/...`). It is faithful enough to catch the failure that matters:
  // a typo in the negative lookahead — which gates whether the middleware (and so
  // the admin auth check + CSP) runs at all — would flip these expectations.
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it('runs the middleware on app routes (so the admin gate, session refresh, and CSP apply)', () => {
    expect(matcher.test('/admin')).toBe(true);
    expect(matcher.test('/admin/projects')).toBe(true);
    expect(matcher.test('/admin/projects/123')).toBe(true);
    // Every admin section must be matched — an un-gated section would skip the
    // admin auth check AND the CSP. A typo narrowing the lookahead on one of
    // these would otherwise pass unnoticed.
    expect(matcher.test('/admin/experience')).toBe(true);
    expect(matcher.test('/admin/skills')).toBe(true);
    expect(matcher.test('/admin/settings')).toBe(true);
    // `/auth/callback` MUST run the middleware so the session is set and the CSP
    // nonce is applied to the callback response.
    expect(matcher.test('/auth/callback')).toBe(true);
  });

  it('skips the middleware for Next internals and static assets', () => {
    expect(matcher.test('/_next/static/chunk.js')).toBe(false);
    expect(matcher.test('/favicon.ico')).toBe(false);
    expect(matcher.test('/logo.png')).toBe(false);
  });
});
