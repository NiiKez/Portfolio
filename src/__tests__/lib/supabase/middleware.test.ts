import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    ADMIN_EMAIL: 'admin@example.com',
  },
}));

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

type ClientOptions = {
  cookies: {
    getAll: () => unknown;
    setAll: (cookies: CookieToSet[]) => void;
  };
};

const getUser = vi.fn();
let cookiesToWrite: CookieToSet[] = [];

const createServerClient = vi.fn(
  (_url: string, _key: string, options: ClientOptions) => {
    // Exercise the cookie wiring: read existing cookies then write any back.
    options.cookies.getAll();
    if (cookiesToWrite.length > 0) {
      options.cookies.setAll(cookiesToWrite);
    }
    return {
      auth: { getUser },
    };
  },
);

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: [string, string, ClientOptions]) =>
    createServerClient(...args),
}));

import { updateSession } from '@/lib/supabase/middleware';

function requestFor(path: string) {
  return new NextRequest(new URL(`http://localhost:3000${path}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  cookiesToWrite = [];
  getUser.mockResolvedValue({ data: { user: null } });
});

describe('updateSession', () => {
  it('returns the user resolved by supabase.auth.getUser', async () => {
    const user = { id: 'admin-uid', email: 'admin@example.com' };
    getUser.mockResolvedValue({ data: { user } });

    const { user: returnedUser } = await updateSession(requestFor('/admin'));

    expect(returnedUser).toEqual(user);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('returns null when there is no authenticated user', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const { user } = await updateSession(requestFor('/'));

    expect(user).toBeNull();
  });

  it('writes cookies set by the supabase client back onto the response', async () => {
    cookiesToWrite = [
      { name: 'sb-access-token', value: 'access-123', options: { path: '/' } },
      { name: 'sb-refresh-token', value: 'refresh-456' },
    ];

    const { response } = await updateSession(requestFor('/admin'));

    expect(response.cookies.get('sb-access-token')?.value).toBe('access-123');
    expect(response.cookies.get('sb-refresh-token')?.value).toBe('refresh-456');
  });

  it('returns a NextResponse', async () => {
    const { response } = await updateSession(requestFor('/'));

    expect(response).toBeInstanceOf(NextResponse);
  });

  it('forwards extra request headers (the CSP nonce) to the downstream request', async () => {
    const { response } = await updateSession(requestFor('/'), {
      'x-nonce': 'abc123',
    });

    // NextResponse.next({ request: { headers } }) encodes overridden request
    // headers as `x-middleware-request-*` (+ a list in override-headers) so the
    // downstream render sees them.
    expect(response.headers.get('x-middleware-override-headers')).toContain(
      'x-nonce',
    );
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe('abc123');
  });

  it('still forwards the nonce after a cookie refresh', async () => {
    cookiesToWrite = [
      { name: 'sb-access-token', value: 'fresh', options: { path: '/' } },
    ];

    const { response } = await updateSession(requestFor('/admin'), {
      'x-nonce': 'abc123',
    });

    // The response is rebuilt inside setAll; the nonce must survive that rebuild.
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe('abc123');
    expect(response.cookies.get('sb-access-token')?.value).toBe('fresh');
  });
});
