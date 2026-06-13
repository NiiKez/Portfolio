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

  it('returns 200 and calls signInWithOtp with shouldCreateUser:false and the callback redirect', async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ email: 'admin@example.com' })),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'admin@example.com',
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
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

  it('prefers x-real-ip over x-forwarded-for for the rate-limit key', async () => {
    await POST(
      makeRequest(JSON.stringify({ email: 'admin@example.com' }), {
        'x-real-ip': '203.0.113.7',
        'x-forwarded-for': '9.9.9.9, 10.0.0.1',
      }),
    );

    expect(rateLimitMock).toHaveBeenCalledWith(
      'send-otp:203.0.113.7',
      5,
      15 * 60 * 1000,
    );
  });
});
