import { NextResponse, type NextRequest } from 'next/server';

import { isAdminEmail } from '@/lib/admin-email';
import { buildCsp, generateNonce } from '@/lib/csp';
import { env } from '@/lib/env';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Site-wide HTTP Basic Auth gate for private preview deployments.
 *
 * Active only when `SITE_PASSWORD` is set — so local dev and a future public
 * launch are unaffected (leave it unset). When set, every request is challenged
 * with `WWW-Authenticate: Basic` and must carry
 * `Authorization: Basic base64("admin:<SITE_PASSWORD>")`, except the `/auth/*`
 * routes which complete the admin magic-link flow (the link is opened from an
 * email, where Basic credentials may not be present yet). Static assets are not
 * matched by the middleware at all (see `config.matcher`).
 *
 * Returns a `401` response to block the request, or `null` to let it through.
 */
function siteGate(request: NextRequest): NextResponse | null {
  const password = env.SITE_PASSWORD;
  if (!password) return null;
  if (request.nextUrl.pathname.startsWith('/auth/')) return null;

  const header = request.headers.get('authorization') ?? '';
  const expected = `Basic ${btoa(`admin:${password}`)}`;

  // Length check first so the constant-ish `!==` doesn't leak length via timing.
  if (header.length === expected.length && header === expected) return null;

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Portfolio", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}

export async function middleware(request: NextRequest) {
  // Per-request CSP nonce. It is injected into the forwarded request headers so
  // Next.js stamps it onto its own inline bootstrap scripts (and so the root
  // layout can read it for next-themes via `x-nonce`), and set on the response
  // so the browser enforces it. Because the nonce changes every request, the
  // CSP cannot live in the static `next.config.ts` header set, and pages must
  // render dynamically (see `export const dynamic` in the root layout) — a
  // cached page would carry a stale nonce that no longer matches the header.
  // Built up-front so every response below — pass-through, 401, or redirect —
  // carries the CSP, not just the pass-through one.
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  const blocked = siteGate(request);
  if (blocked) {
    blocked.headers.set('Content-Security-Policy', csp);
    return blocked;
  }

  const { response, user } = await updateSession(request, {
    'x-nonce': nonce,
    'Content-Security-Policy': csp,
  });
  response.headers.set('Content-Security-Policy', csp);

  const { pathname } = request.nextUrl;

  const isLoginRoute = pathname === '/admin/login';
  const isAdminRoute = pathname.startsWith('/admin');
  const isAdmin = isAdminEmail(user?.email);

  // Build a redirect that carries the CSP AND any auth cookies refreshed by
  // updateSession(). Dropping the refreshed cookies would leave the browser
  // holding an already-rotated refresh token, which can trip Supabase's
  // reuse-detection and silently log the admin out on the next request.
  function redirectTo(target: string) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = '';
    const redirect = NextResponse.redirect(url);
    redirect.headers.set('Content-Security-Policy', csp);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  if (isAdminRoute && !isLoginRoute && !isAdmin) {
    return redirectTo('/admin/login');
  }

  if (isLoginRoute && isAdmin) {
    return redirectTo('/admin');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and Next.js internals.
     * Required so Supabase can refresh the auth token on every response.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    /*
     * The pattern above excludes ANY path ending in a static-asset extension —
     * including under /admin (e.g. `/admin/projects/x.png`), which would let an
     * admin route skip the auth gate + CSP entirely. Re-include the whole /admin
     * subtree unconditionally so no extension suffix can bypass the middleware.
     */
    '/admin/:path*',
  ],
};
