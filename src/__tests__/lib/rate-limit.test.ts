import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { rateLimit } from '@/lib/rate-limit';

const WINDOW = 15 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe('rateLimit', () => {
  it('allows the first request with retryAfter 0', () => {
    const result = rateLimit('first-request-allowed', 5, WINDOW);

    expect(result).toEqual({ allowed: true, retryAfter: 0 });
  });

  it('allows up to maxRequests and blocks the next one', () => {
    const key = 'up-to-max-then-block';
    const max = 5;

    for (let i = 0; i < max; i++) {
      const result = rateLimit(key, max, WINDOW);
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBe(0);
    }

    const blocked = rateLimit(key, max, WINDOW);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('returns retryAfter as the ceil of the remaining seconds in the window', () => {
    vi.useFakeTimers();
    const start = 1_000_000_000_000;
    vi.setSystemTime(start);

    const key = 'retry-after-ceil';
    const max = 1;
    const windowMs = 10_000;

    // First request opens the window (resetAt = start + 10000).
    rateLimit(key, max, windowMs);

    // Advance 2.5s; remaining = 7500ms -> ceil(7.5) = 8.
    vi.setSystemTime(start + 2500);
    const blocked = rateLimit(key, max, windowMs);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(8);
  });

  it('resets the counter once the window has expired', () => {
    vi.useFakeTimers();
    const start = 2_000_000_000_000;
    vi.setSystemTime(start);

    const key = 'window-reset';
    const max = 2;
    const windowMs = 5_000;

    rateLimit(key, max, windowMs);
    rateLimit(key, max, windowMs);
    const blockedBeforeReset = rateLimit(key, max, windowMs);
    expect(blockedBeforeReset.allowed).toBe(false);

    // Advance strictly past the window (now > resetAt).
    vi.setSystemTime(start + windowMs + 1);
    const afterReset = rateLimit(key, max, windowMs);

    expect(afterReset).toEqual({ allowed: true, retryAfter: 0 });

    // Counter genuinely reset: a fresh max-1 more should still pass.
    expect(rateLimit(key, max, windowMs).allowed).toBe(true);
    expect(rateLimit(key, max, windowMs).allowed).toBe(false);
  });

  it('blocks exactly at the >= boundary (maxRequests = 1)', () => {
    const key = 'boundary-max-one';

    const first = rateLimit(key, 1, WINDOW);
    expect(first.allowed).toBe(true);

    const second = rateLimit(key, 1, WINDOW);
    expect(second.allowed).toBe(false);
  });

  it('tracks distinct keys independently', () => {
    const keyA = 'distinct-key-a';
    const keyB = 'distinct-key-b';
    const max = 1;

    expect(rateLimit(keyA, max, WINDOW).allowed).toBe(true);
    // keyA is now exhausted, but keyB is untouched.
    expect(rateLimit(keyA, max, WINDOW).allowed).toBe(false);
    expect(rateLimit(keyB, max, WINDOW).allowed).toBe(true);
  });
});
