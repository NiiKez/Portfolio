import { createBrowserClient } from '@supabase/ssr';

import { clientEnv } from '@/lib/env.client';

/**
 * Supabase client for use in Client Components.
 *
 * Reads/writes the auth session from `document.cookie` so that it stays in
 * sync with the server-side session managed by the middleware.
 */
export function createClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { db: { schema: 'portfolio' } },
  );
}
