import 'server-only';

import type { NextRequest } from 'next/server';

/**
 * Best-effort real client IP for rate-limit keys.
 *
 * The LEFTMOST `x-forwarded-for` entry is fully attacker-controlled — a client
 * can send any `X-Forwarded-For` header it likes — so keying a rate limit on it
 * lets an attacker rotate the value per request and evade the limit entirely.
 * The trustworthy value is the one our own reverse proxy sets, so we prefer:
 *
 *   1. `x-real-ip` — set by the trusted proxy to the actual TCP peer, then
 *   2. the RIGHTMOST `x-forwarded-for` entry — the address the proxy *appended*
 *      for the host that connected to it (a forged leftmost value is shifted
 *      left and ignored), then
 *   3. `'unknown'` — a shared bucket when neither header is present (e.g. local
 *      dev), which fails closed rather than open.
 *
 * This assumes exactly ONE trusted proxy in front of the app (the deploy host's
 * reverse proxy). If more proxies are added in front, take the entry that many
 * hops from the right instead of the last one.
 */
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const last = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1);
    if (last) return last;
  }

  return 'unknown';
}
