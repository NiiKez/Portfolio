import { createClient } from '@supabase/supabase-js';

import { clientEnv } from '@/lib/env.client';
import type { Database } from '@/types/database';

/**
 * Cookie-free Supabase client for PUBLIC, read-only data.
 *
 * Unlike `@/lib/supabase/server`, this does NOT call `cookies()`. Reading
 * cookies forces a page into dynamic rendering, which silently disables
 * `export const revalidate` (ISR) and hits Supabase on every request. By
 * using the plain `@supabase/supabase-js` client with no cookie handling,
 * pages that only read public data (e.g. `/`, `/projects`,
 * `/projects/[id]`, `/about`) stay statically generatable / ISR-able.
 *
 * It carries NO user session, so it must only be used for PUBLIC reads —
 * never for anything that depends on auth or row-level user context.
 */
export function createPublicClient() {
  return createClient<Database, 'portfolio'>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      db: { schema: 'portfolio' },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
