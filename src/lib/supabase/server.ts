import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Supabase client for use in Server Components, Route Handlers, and
 * Server Actions.
 *
 * `cookies()` is asynchronous in Next.js 15+, so this factory must be
 * awaited. The `setAll` handler will throw inside Server Components
 * (cookies cannot be set during rendering) — that case is swallowed
 * because the middleware client is responsible for refreshing the
 * session and persisting cookies on every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, 'portfolio'>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      db: { schema: 'portfolio' },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — safe to ignore as long as
            // the middleware client is refreshing the session.
          }
        },
      },
    },
  );
}
