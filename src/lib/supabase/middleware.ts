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
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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
