import { createClient } from '@supabase/supabase-js';

import { clientEnv } from '@/lib/env.client';
import type { Database } from '@/types/database';

/**
 * Cookie-free Supabase client for PUBLIC, read-only data.
 *
 * Unlike `@/lib/supabase/server`, this does NOT call `cookies()`. Public pages
 * (`/`, `/projects`, `/projects/[id]`, `/about`) read through this plain
 * `@supabase/supabase-js` client so their queries run on the anon /
 * `public_read` RLS path and carry NO user session — they never touch the
 * authenticated server client or its cookie machinery. (Rendering is dynamic
 * app-wide regardless — see the per-request CSP nonce in `src/middleware.ts`
 * and `force-dynamic` in the root layout — so this is about the data path and
 * least privilege, not static/ISR generation.)
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
