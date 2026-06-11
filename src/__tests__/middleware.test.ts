import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

    const result = await middleware(requestFor('/admin/projects'));

    expect(result.status).toBe(307);
    const location = new URL(result.headers.get('location') as string);
    expect(location.host).toBe('localhost:3000');
    expect(location.pathname).toBe('/admin/login');
  });

  it('redirects a non-admin user away from an admin route to /admin/login', async () => {
    mockSession({ email: 'someone@else.com' });

    const result = await middleware(requestFor('/admin/projects'));

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
  });

  it('redirects an already-authenticated admin away from the login route to /admin', async () => {
    mockSession({ email: 'admin@example.com' });

    const result = await middleware(requestFor('/admin/login'));

    expect(result.status).toBe(307);
    const location = new URL(result.headers.get('location') as string);
    expect(location.host).toBe('localhost:3000');
    expect(location.pathname).toBe('/admin');
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
