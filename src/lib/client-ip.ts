import 'server-only';

import type { NextRequest } from 'next/server';

/**
 * Best-effort real client IP for rate-limit keys.
 *
 * `x-forwarded-for` is a comma-separated chain whose LEFTMOST entries are fully
 * attacker-controlled — a client can send any `X-Forwarded-For` it likes — so
 * keying a rate limit on them lets an attacker rotate the value per request and
 * evade the limit entirely. The trustworthy value is the RIGHTMOST entry: the
 * address our single front proxy *appended* for the host that actually connected
 * to it (a forged leftmost value is shifted left and ignored).
 *
 * This app is fronted directly by Azure Container Apps' Envoy ingress — a single
 * trusted hop. Envoy appends the real TCP peer as the rightmost `x-forwarded-for`
 * entry and does NOT set `x-real-ip`. We therefore key on the rightmost
 * `x-forwarded-for` entry and deliberately do NOT trust `x-real-ip`: nothing in
 * front of us authoritatively sets or strips it, so a client-supplied
 * `X-Real-IP` would be forgeable and let an attacker mint a fresh rate-limit
 * bucket per request. (If a reverse proxy that authoritatively sets `x-real-ip`
 * is ever placed in front, or more proxy hops are added, revisit this — take the
 * entry that many hops from the right.)
 *
 * Falls back to `'unknown'` — a single shared bucket — when no forwarded chain
 * is present (e.g. local dev), which fails closed rather than open.
 */
export function getClientIp(request: NextRequest): string {
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
