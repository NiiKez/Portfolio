import 'server-only';

/**
 * In-memory, per-process rate-limit store.
 *
 * The counter store is a module-global `Map` scoped to a single Node process.
 * In a multi-replica deploy (e.g. Azure Container Apps scaled to >1 replica)
 * each replica keeps its own store, so the effective limit is enforced
 * per-replica, not globally — N replicas allow up to N× the configured limit.
 * The app currently assumes a single replica. Enforcing a true global limit
 * across replicas would require a shared store (Redis / Postgres).
 *
 * Memory is bounded by amortized eviction: expired entries are swept out at
 * most once per `SWEEP_INTERVAL_MS` (see `sweepExpired`), so one-shot keys
 * (per-IP `track:`, rotated `send-otp-email:`) cannot accumulate indefinitely.
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Amortized eviction: sweeping every call would be O(n); gating the sweep
// behind a fixed interval keeps the per-call cost amortized O(1) while still
// reclaiming memory from keys that are never re-hit.
const SWEEP_INTERVAL_MS = 60_000;
let lastSweepAt = 0;

/**
 * Deletes entries whose window has already passed. This does NOT change
 * rate-limiting behavior: an expired entry is already treated as a fresh
 * window by the `!entry || now > entry.resetAt` check below, so the sweep
 * only reclaims memory. Runs at most once per `SWEEP_INTERVAL_MS`.
 */
function sweepExpired(now: number): void {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  sweepExpired(now);
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
 * Clears the in-memory counter store and resets the sweep bookkeeping.
 * Test-only: the store is module-global and never expires within a run, so
 * without this a test's counts could bleed into another that reuses the same
 * key (or runs in a different order between the parallel local run and the
 * serialized CI run). Resetting `lastSweepAt` keeps eviction timing isolated
 * between cases. Production code must not call this.
 */
export function __resetRateLimit(): void {
  store.clear();
  lastSweepAt = 0;
}

/**
 * Returns the current number of entries in the store. Test-only: lets eviction
 * tests assert the map actually shrinks once expired keys are swept. Production
 * code must not call this.
 */
export function __rateLimitSize(): number {
  return store.size;
}
