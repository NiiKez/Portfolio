import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Service-role Supabase client — **BYPASSES Row Level Security**. Server-only.
 *
 * Use ONLY inside server code that has already verified the caller is the admin
 * (e.g. the `ADMIN_EMAIL` gate in `safeAction`). The service-role key is a
 * full-access secret: it must never be sent to the browser, returned from an
 * action, or used in a client component.
 *
 * Why this exists: storage writes to the admin-only buckets are authorised by
 * Storage RLS, but this project shares its Supabase instance with another app
 * whose storage policies diverge from this repo's migrations. Minting a signed
 * upload URL / cleaning up storage from an already-admin-gated action with the
 * service role is reliable and still safe — direct (non-admin) writes to the
 * bucket remain blocked by RLS; only this server path bypasses it.
 */
export function createAdminClient() {
  return createClient<Database, 'portfolio'>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      db: { schema: 'portfolio' },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
