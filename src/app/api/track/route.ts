import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { sanitizePath, sanitizeReferrer } from '@/lib/analytics';
import { getClientIp } from '@/lib/client-ip';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * First-party page-view ingest. The public site beacons one POST per navigation
 * (see `page-view-tracker.tsx`). This is the ONLY ingress to
 * `portfolio.page_views`: the table has RLS on with no policies, so no client
 * can insert directly — the row is written here with the service-role client
 * after a same-origin + rate-limit + validation gauntlet, never exposing a
 * public write path.
 *
 * It is deliberately best-effort and side-channel-quiet: a dropped/invalid
 * payload returns the same `204` as a recorded one, so the endpoint can't be
 * probed as an oracle, and a storage failure never surfaces to the visitor.
 */

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 60;

const schema = z.object({
  path: z.string(),
  referrer: z.string().optional(),
});

// 204 with no body — what every non-error outcome returns (recorded or dropped).
function noContent() {
  return new NextResponse(null, { status: 204 });
}

// Strip a trailing `:port` so a `Host: site:443` header still matches a
// port-less Origin host (mirrors the self-host handling in `sanitizeReferrer`).
function stripPort(host: string): string {
  return host.replace(/:\d+$/, '');
}

// Parse the Origin header down to its bare hostname, or null if
// absent/unparseable. `Origin: null` (opaque origins) and any malformed value
// must NOT throw — a thrown `new URL()` would surface as a 500 and break the
// "always quiet" contract (turning the route into an error oracle / log-spam
// vector). `hostname` (not `host`) already excludes the port.
function originHost(origin: string | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Same-origin guard: the beacon is only ever sent same-origin, so reject
  // cross-site POSTs that would let any page inflate the counts. Compare on the
  // bare hostname — ports stripped and lower-cased on both sides (`originHost`
  // returns a WHATWG-lowercased `.hostname`) — so a proxy that forwards
  // `Host: site:443` or a mixed-case host against a port-less `Origin` host
  // doesn't 403 every beacon.
  const rawHost = request.headers.get('host');
  const host = rawHost ? stripPort(rawHost).toLowerCase() : null;
  const reqOriginHost = originHost(request.headers.get('origin'));
  if (!reqOriginHost || !host || reqOriginHost !== host) {
    return new NextResponse(null, { status: 403 });
  }

  // Throttle per trusted client IP so a single source can't flood the table.
  const ip = getClientIp(request);
  const limited = rateLimit(`track:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!limited.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: { 'Retry-After': String(limited.retryAfter) },
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return noContent();

  const path = sanitizePath(parsed.data.path);
  if (!path) return noContent();

  const referrer = sanitizeReferrer(parsed.data.referrer, host);

  // Service-role insert: bypasses RLS by design (the table has no policies).
  // Best-effort — a failure here must never break the visitor's navigation.
  try {
    const { error } = await createAdminClient()
      .from('page_views')
      .insert({ path, referrer });
    if (error) {
      // PostgREST resolves (not rejects) on a DB error, so the catch below
      // never sees it. Log server-side only (never to the visitor) so a silent
      // total failure — e.g. schema drift or a missing table — is observable.
      console.warn('[track] page_views insert failed:', error.message);
    }
  } catch {
    // Swallow: analytics is non-critical and must stay invisible to visitors.
  }

  return noContent();
}
