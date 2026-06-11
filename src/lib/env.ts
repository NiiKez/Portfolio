import 'server-only';

import { z } from 'zod';

import { clientEnv, type ClientEnv } from '@/lib/env.client';

const serverEnvSchema = z.object({
  ADMIN_EMAIL: z.email(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Optional site-wide HTTP Basic Auth gate. When set, the WHOLE site is locked
  // behind it (see `src/middleware.ts`); when unset, the gate is off. Used for
  // private preview deployments — leave empty for local dev and public launch.
  SITE_PASSWORD: z.string().min(1).optional(),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;
export type Env = ClientEnv & ServerEnv;

function loadServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Missing or invalid environment variables:\n${formatted}`);
  }

  return result.data;
}

let cachedServer: ServerEnv | undefined;
function serverEnv(): ServerEnv {
  return (cachedServer ??= loadServerEnv());
}

/**
 * Server-side env, validated **lazily and per-group on first access** (not at
 * import): the public getters validate only the client schema; `ADMIN_EMAIL`
 * validates only the server schema. The decoupling matters — it lets a static
 * page that reads only the public vars (e.g. the Supabase server client at
 * build) succeed without the runtime-only `ADMIN_EMAIL` secret, which the
 * platform injects at deploy/runtime, not at build. Eager/coupled validation
 * here would crash `next build` the moment any bundled module imports `env`.
 */
export const env: Env = {
  get NEXT_PUBLIC_SUPABASE_URL() {
    return clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  },
  get ADMIN_EMAIL() {
    return serverEnv().ADMIN_EMAIL;
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  },
  get SITE_PASSWORD() {
    return serverEnv().SITE_PASSWORD;
  },
};
