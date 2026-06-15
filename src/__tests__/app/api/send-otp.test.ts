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

// Mock the canonical site origin to something DISTINCT from the request host so
// the redirect_to assertion can prove `emailRedirectTo` is derived from
// getBaseUrl() and NOT from request.url (the regression that keeps breaking
// magic-link login behind a proxy).
vi.mock('@/lib/site-url', () => ({
  getBaseUrl: () => 'https://portfolio.example',
}));

const signInWithOtp = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithOtp },
  })),
}));

import { POST } from '@/app/api/auth/send-otp/route';

function makeRequest(
  body: string | null,
  headers: Record<string, string> = {},
) {
  const request = new NextRequest('http://localhost:3000/api/auth/send-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ?? undefined,
  });
  // `origin`/`host` are forbidden request headers and are dropped when passed
  // via the constructor's `headers` option, so set them after construction.
  const merged: Record<string, string> = {
    'x-forwarded-for': '1.2.3.4',
    origin: 'http://localhost:3000',
    host: 'localhost:3000',
    ...headers,
  };
  for (const [name, value] of Object.entries(merged)) {
    request.headers.set(name, value);
  }
  return request;
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockReturnValue({ allowed: true, retryAfter: 0 });
  signInWithOtp.mockResolvedValue({ error: null });
});

describe('POST /api/auth/send-otp', () => {
  it('returns 403 when the Origin header is missing (CSRF guard)', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/send-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com' }),
    });
    request.headers.set('host', 'localhost:3000'); // host set, origin omitted

    const res = await POST(request);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('returns 403 when the Origin host does not match Host (cross-site)', async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ email: 'admin@example.com' }), {
        origin: 'https://evil.example',
      }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('rate-limits per target email address', async () => {
    await POST(makeRequest(JSON.stringify({ email: 'Admin@Example.com' })));

    expect(rateLimitMock).toHaveBeenCalledWith(
      'send-otp-email:admin@example.com',
      5,
      15 * 60 * 1000,
    );
  });

  it('returns 429 with a Retry-After header when rate limited', async () => {
    rateLimitMock.mockReturnValue({ allowed: false, retryAfter: 42 });

    const res = await POST(
      makeRequest(JSON.stringify({ email: 'admin@example.com' })),
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(await res.json()).toEqual({
      error: 'Too many requests. Please try again later.',
    });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('returns 429 from the per-email branch when the IP is allowed but the email is rate-limited', async () => {
    // Key-aware mock: the per-IP check passes, but the per-EMAIL check trips. This
    // exercises the per-email rate-limit branch in the route, which the blanket
    // "rate limited" test never reaches (that one trips the per-IP check first).
    rateLimitMock.mockImplementation((key: string) => {
      if (key === 'send-otp:1.2.3.4') return { allowed: true, retryAfter: 0 };
      if (key === 'send-otp-email:admin@example.com') {
        return { allowed: false, retryAfter: 99 };
      }
      throw new Error(`unexpected rate-limit key: ${key}`);
    });

    const res = await POST(
      makeRequest(JSON.stringify({ email: 'admin@example.com' })),
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('99');
    expect(await res.json()).toEqual({
      error: 'Too many requests. Please try again later.',
    });
    // Both checks ran (IP first, then email) before the email branch blocked it.
    expect(rateLimitMock).toHaveBeenCalledWith(
      'send-otp:1.2.3.4',
      5,
      15 * 60 * 1000,
    );
    expect(rateLimitMock).toHaveBeenCalledWith(
      'send-otp-email:admin@example.com',
      5,
      15 * 60 * 1000,
    );
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed / empty body', async () => {
    const res = await POST(makeRequest('not json'));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid email address.' });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid email', async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ email: 'not-an-email' })),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid email address.' });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('builds emailRedirectTo from getBaseUrl(), not the request URL', async () => {
    // Send the request through a DIFFERENT host than the mocked site origin. The
    // CSRF guard requires Origin.host === Host, so both stay on the mangled-proxy
    // host; the point is that emailRedirectTo must still be the mocked
    // getBaseUrl() origin (https://portfolio.example), proving the redirect is
    // NOT taken from request.url. If the route ever regresses to request.url, the
    // redirect would carry `mangled-proxy.test` and this assertion would fail.
    const res = await POST(
      makeRequest(JSON.stringify({ email: 'admin@example.com' }), {
        origin: 'https://mangled-proxy.test',
        host: 'mangled-proxy.test',
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'admin@example.com',
      options: {
        emailRedirectTo: 'https://portfolio.example/auth/callback',
        shouldCreateUser: false,
      },
    });

    const call = signInWithOtp.mock.calls[0]![0] as {
      options: { emailRedirectTo: string };
    };
    expect(new URL(call.options.emailRedirectTo).host).toBe(
      'portfolio.example',
    );
    expect(new URL(call.options.emailRedirectTo).host).not.toBe(
      'mangled-proxy.test',
    );
  });

  it('accepts a valid non-admin email and never creates an account (no enumeration oracle)', async () => {
    // Intentional posture: anyone may REQUEST a magic link — admin enforcement
    // happens at the callback, not here, so the endpoint does not reveal which
    // address is the admin (sending only to the admin would leak that via
    // differential responses). `shouldCreateUser: false` is the load-bearing
    // flag that stops this endpoint from doubling as an account-creation /
    // enumeration oracle; pin both so a refactor that drops the flag, or that
    // starts rejecting non-admin emails, fails here.
    const res = await POST(
      makeRequest(JSON.stringify({ email: 'someone@else.com' })),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'someone@else.com',
      options: {
        emailRedirectTo: 'https://portfolio.example/auth/callback',
        shouldCreateUser: false,
      },
    });
  });

  it('returns 400 when signInWithOtp reports an error', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'smtp down' } });

    const res = await POST(
      makeRequest(JSON.stringify({ email: 'admin@example.com' })),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Failed to send sign-in link.' });
  });

  it('keys the rate limit on the trusted (rightmost) x-forwarded-for IP, not the spoofable leftmost one', async () => {
    await POST(
      makeRequest(JSON.stringify({ email: 'admin@example.com' }), {
        'x-forwarded-for': '9.9.9.9, 10.0.0.1',
      }),
    );

    expect(rateLimitMock).toHaveBeenCalledWith(
      'send-otp:10.0.0.1',
      5,
      15 * 60 * 1000,
    );
  });

  it('ignores the client-forgeable x-real-ip and keys on the rightmost x-forwarded-for IP', async () => {
    await POST(
      makeRequest(JSON.stringify({ email: 'admin@example.com' }), {
        'x-real-ip': '203.0.113.7',
        'x-forwarded-for': '9.9.9.9, 10.0.0.1',
      }),
    );

    expect(rateLimitMock).toHaveBeenCalledWith(
      'send-otp:10.0.0.1',
      5,
      15 * 60 * 1000,
    );
  });
});
