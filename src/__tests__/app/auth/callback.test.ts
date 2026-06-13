import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    ADMIN_EMAIL: 'admin@example.com',
  },
}));

const rateLimitMock = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
}));

const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();
const signOut = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession, getUser, signOut },
  })),
}));

import { GET } from '@/app/auth/callback/route';

function makeRequest(url = 'http://localhost:3000/auth/callback?code=abc') {
  return new NextRequest(url);
}

function location(res: Response) {
  return new URL(res.headers.get('location') as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockReturnValue({ allowed: true, retryAfter: 0 });
  exchangeCodeForSession.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { email: 'admin@example.com' } } });
  signOut.mockResolvedValue({ error: null });
});

describe('GET /auth/callback', () => {
  it('redirects to ?error=rate_limited when rate limited', async () => {
    rateLimitMock.mockReturnValue({ allowed: false, retryAfter: 5 });

    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    const loc = location(res);
    expect(loc.pathname).toBe('/admin/login');
    expect(loc.searchParams.get('error')).toBe('rate_limited');
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('redirects to ?error=auth_failed when the code is missing', async () => {
    const res = await GET(makeRequest('http://localhost:3000/auth/callback'));

    expect(res.status).toBe(307);
    const loc = location(res);
    expect(loc.pathname).toBe('/admin/login');
    expect(loc.searchParams.get('error')).toBe('auth_failed');
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('redirects to ?error=auth_failed when the code exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: 'bad code' },
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    const loc = location(res);
    expect(loc.pathname).toBe('/admin/login');
    expect(loc.searchParams.get('error')).toBe('auth_failed');
    expect(getUser).not.toHaveBeenCalled();
  });

  it('signs out and redirects to ?error=unauthorized for a non-admin user', async () => {
    getUser.mockResolvedValue({
      data: { user: { email: 'intruder@example.com' } },
    });

    const res = await GET(makeRequest());

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(307);
    const loc = location(res);
    expect(loc.pathname).toBe('/admin/login');
    expect(loc.searchParams.get('error')).toBe('unauthorized');
  });

  it('redirects an admin user to /admin without signing out', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    const loc = location(res);
    expect(loc.pathname).toBe('/admin');
    expect(loc.searchParams.get('error')).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('ignores a ?next open-redirect param and lands on /admin under the request origin', async () => {
    // Regression guard: the route currently does NOT honour any `next` /
    // `redirect_to` query param — it only ever redirects to hardcoded paths under
    // the server-derived `origin`. A successful admin callback carrying an
    // attacker-supplied `?next=https://evil.com` must still land on `/admin` on
    // OUR origin, with the attacker's URL having had no effect. This locks in the
    // safe behaviour so a future "preserve the next page" change can't silently
    // introduce an open redirect.
    const res = await GET(
      makeRequest(
        'http://localhost:3000/auth/callback?code=abc&next=https://evil.com',
      ),
    );

    expect(res.status).toBe(307);
    const loc = location(res);
    expect(loc.origin).toBe('http://localhost:3000');
    expect(loc.pathname).toBe('/admin');
    // The attacker's host never appears anywhere in the redirect target.
    expect(res.headers.get('location')).not.toContain('evil.com');
  });
});
