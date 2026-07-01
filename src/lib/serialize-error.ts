/**
 * Normalises an unknown thrown value into a compact, log-safe shape.
 *
 * Every log site previously did `error instanceof Error ? error.message : String(error)`,
 * which threw away the fields on-call actually triages on: Supabase `PostgrestError`
 * carries a `.code` (e.g. `23505`, `PGRST116`, `42501`) and `StorageApiError` a
 * `.status` — both extend `Error`, so `.message` alone is not enough to tell an RLS
 * denial from schema drift from a transient 5xx. This captures those without pulling
 * in row-level `details`/`hint` (which can echo values), keeping the log payload
 * diagnostic but bounded.
 *
 * Pure and dependency-free (no winston, no `server-only`) so it is safe to import
 * anywhere and is exercised for real in tests even when `@/lib/logger` is mocked.
 */
export type SerializedError = {
  name?: string;
  message: string;
  /** Supabase/PostgREST error code (string), when present. */
  code?: string;
  /** HTTP-ish status from Storage/Auth errors, when present. */
  status?: number;
  stack?: string;
};

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    // Circular reference or a non-serialisable value.
    return String(value);
  }
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const e = error as Error & {
      code?: unknown;
      status?: unknown;
      statusCode?: unknown;
    };
    return {
      name: e.name,
      message: e.message,
      code: typeof e.code === 'string' ? e.code : undefined,
      status:
        typeof e.status === 'number'
          ? e.status
          : typeof e.statusCode === 'number'
            ? e.statusCode
            : undefined,
      stack: e.stack,
    };
  }

  if (error && typeof error === 'object') {
    // A thrown plain object (older Supabase shapes, or a rejected literal).
    const e = error as Record<string, unknown>;
    return {
      message: typeof e.message === 'string' ? e.message : safeStringify(e),
      code: typeof e.code === 'string' ? e.code : undefined,
      status: typeof e.status === 'number' ? e.status : undefined,
    };
  }

  return { message: String(error) };
}
