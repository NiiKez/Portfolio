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

// IMPORTANT: this file deliberately does NOT mock `@/lib/rate-limit`. The
// sibling send-otp.test.ts replaces the limiter with a stub, so the real
// in-memory enforcement (counter, window, limit) is never exercised there. Here
// we drive the genuine limiter end-to-end through the route.
vi.mock('@/lib/site-url', () => ({
  getBaseUrl: () => 'https://portfolio.example',
}));

const signInWithOtp = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithOtp },
  })),
}));

import { __resetRateLimit } from '@/lib/rate-limit';
import { POST } from '@/app/api/auth/send-otp/route';

function makeRequest(email: string, ip: string) {
  const request = new NextRequest('http://localhost:3000/api/auth/send-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const merged: Record<string, string> = {
    'x-forwarded-for': ip,
    origin: 'http://localhost:3000',
    host: 'localhost:3000',
  };
  for (const [name, value] of Object.entries(merged)) {
    request.headers.set(name, value);
  }
  return request;
}

beforeEach(() => {
  vi.clearAllMocks();
  // The real limiter's counter store is module-global; clear it so each case
  // starts from zero regardless of order or key reuse.
  __resetRateLimit();
  signInWithOtp.mockResolvedValue({ error: null });
});

describe('POST /api/auth/send-otp (real rate limiter)', () => {
  it('allows the first 5 same-email/same-IP requests and 429s the 6th', async () => {
    // The route caps both keys at 5 requests per 15-minute window
    // (`rateLimit(..., 5, WINDOW_MS)`), so the 6th identical request is the first
    // to be blocked. The per-IP check trips first (same fixed limit).
    const email = 'ratelimit-real@example.com';
    const ip = '192.0.2.55';
    const LIMIT = 5;

    for (let i = 1; i <= LIMIT; i++) {
      const res = await POST(makeRequest(email, ip));
      expect(res.status, `request #${i} should be allowed`).toBe(200);
    }

    expect(signInWithOtp).toHaveBeenCalledTimes(LIMIT);

    const blocked = await POST(makeRequest(email, ip));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      error: 'Too many requests. Please try again later.',
    });
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    // The blocked request never reached Supabase.
    expect(signInWithOtp).toHaveBeenCalledTimes(LIMIT);
  });

  it('enforces the per-EMAIL cap even when each request comes from a fresh IP', async () => {
    // Anti-bombing defence: a rotating/spoofed x-forwarded-for must not let an
    // attacker flood ONE inbox. Hold the email fixed and give every request a
    // distinct IP so the per-IP check passes each time — the per-EMAIL counter
    // is the only thing that can trip. The sibling test above can never prove
    // this branch (its per-IP check trips first). If the per-email `rateLimit`
    // call were removed or mis-keyed, the 6th request would wrongly succeed.
    const email = 'bombed-inbox@example.com';
    const LIMIT = 5;

    for (let i = 1; i <= LIMIT; i++) {
      const res = await POST(makeRequest(email, `198.51.100.${i}`));
      expect(res.status, `request #${i} (fresh IP) should be allowed`).toBe(
        200,
      );
    }
    expect(signInWithOtp).toHaveBeenCalledTimes(LIMIT);

    const blocked = await POST(makeRequest(email, '198.51.100.250'));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    // Still only LIMIT calls reached Supabase — the per-email cap held.
    expect(signInWithOtp).toHaveBeenCalledTimes(LIMIT);
  });
});
