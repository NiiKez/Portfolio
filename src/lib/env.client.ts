import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validate the public env vars. `process.env.NEXT_PUBLIC_*` is read as literal
 * references so Next.js inlines the values into the client bundle at build
 * time. Throws a descriptive error on a missing/invalid value.
 */
function loadClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Missing or invalid public environment variables:\n${formatted}`,
    );
  }

  return result.data;
}

let cached: ClientEnv | undefined;
function clientEnvValue(): ClientEnv {
  return (cached ??= loadClientEnv());
}

/**
 * Public env, validated **lazily on first access** rather than at import. This
 * keeps `next build` from crashing when a value isn't present at build time,
 * while still failing loudly the first time the app actually reads a missing or
 * invalid value. The access shape (`clientEnv.NEXT_PUBLIC_*`) is unchanged for
 * callers.
 */
export const clientEnv: ClientEnv = {
  get NEXT_PUBLIC_SUPABASE_URL() {
    return clientEnvValue().NEXT_PUBLIC_SUPABASE_URL;
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return clientEnvValue().NEXT_PUBLIC_SUPABASE_ANON_KEY;
  },
};
