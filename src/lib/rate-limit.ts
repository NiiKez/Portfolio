import 'server-only';

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

/**
 * Clears the in-memory counter store. Test-only: the store is module-global and
 * never expires within a run, so without this a test's counts could bleed into
 * another that reuses the same key (or runs in a different order between the
 * parallel local run and the serialized CI run). Production code must not call
 * this.
 */
export function __resetRateLimit(): void {
  store.clear();
}
