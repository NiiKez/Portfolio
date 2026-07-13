import 'server-only';

import type { NextRequest } from 'next/server';

/**
 * Browser-CSRF guard for the unauthenticated POST endpoints (`send-otp`,
 * `signout`). A same-site browser sends a truthful `Origin`; a cross-site page
 * cannot forge one, so requiring `Origin`'s host to equal the request `Host`
 * blocks cross-site form/fetch abuse. It is NOT caller authentication — a
 * scripted (non-browser) client can set both headers freely; volume abuse is
 * bounded by the rate limiters, and mutations are additionally gated by
 * `safeAction` + RLS.
 *
 * Compared on the bare hostname (ports stripped, lower-cased) so a proxy that
 * forwards `Host: site:443` against a port-less `Origin` doesn't wrongly 403.
 * Parsing NEVER throws: `Origin: null` (opaque origins from sandboxed iframes /
 * `data:` documents) and any malformed value resolve to `null` and fail the
 * check — returning the intended 403 instead of an unhandled 500 that would
 * become an error/log-noise oracle.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const originHost = parseHostname(request.headers.get('origin'));
  const rawHost = request.headers.get('host');
  const host = rawHost ? stripPort(rawHost).toLowerCase() : null;
  return Boolean(originHost && host && originHost === host);
}

function parseHostname(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function stripPort(host: string): string {
  // Bracketed IPv6 literals ([::1]:3001) keep their colons; only strip a
  // trailing :port that comes after the closing bracket (or when unbracketed).
  const colon = host.lastIndexOf(':');
  return colon > host.lastIndexOf(']') ? host.slice(0, colon) : host;
}
