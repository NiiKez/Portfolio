import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';

/**
 * Refreshes the Supabase auth session on every matched request.
 *
 * Returns the `NextResponse` that should be forwarded — it carries any
 * `Set-Cookie` headers written by the Supabase client during a token
 * refresh. The caller (the project-root `middleware.ts`) is responsible
 * for any redirects after this runs.
 *
 * `extraRequestHeaders` are merged onto the forwarded request headers so values
 * the caller computes per request (the CSP nonce: `x-nonce` +
 * `Content-Security-Policy`) reach the downstream render. The forwarded headers
 * are rebuilt from the live `request` AFTER any cookie refresh, so both the
 * refreshed auth cookies and the extra headers propagate together.
 */
export async function updateSession(
  request: NextRequest,
  extraRequestHeaders?: Record<string, string>,
) {
  function nextResponse() {
    if (!extraRequestHeaders) return NextResponse.next({ request });
    const headers = new Headers(request.headers);
    for (const [name, value] of Object.entries(extraRequestHeaders)) {
      headers.set(name, value);
    }
    return NextResponse.next({ request: { headers } });
  }

  let response = nextResponse();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = nextResponse();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touch the session so token refreshes are written back to the response
  // cookies. Do not remove — see Supabase SSR docs for the rationale.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
