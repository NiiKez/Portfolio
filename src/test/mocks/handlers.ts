/**
 * MSW request handlers — intentionally EMPTY.
 *
 * Every test mocks Supabase at the module boundary (`vi.mock('@/lib/supabase/*')`
 * and friends), so no test ever issues a real network request. The MSW server
 * (see `src/test/setup.ts`) is kept purely as a NETWORK TRIPWIRE: with
 * `onUnhandledRequest: 'error'`, any accidental real request — e.g. a new test
 * that forgets to mock the Supabase client — fails loudly instead of silently
 * hitting the live, shared Supabase project.
 *
 * This file previously held hand-rolled PostgREST/auth/storage handlers, but
 * nothing exercised them and they did not model real PostgREST semantics (e.g.
 * PATCH/DELETE ignored the `?id=eq.` filter and mutated EVERY row, GET ignored
 * `select`/`order`). That made them a false-confidence trap: if a test were ever
 * wired through a real client, broken query code (a dropped `.eq()` filter)
 * would pass green. If integration-style coverage is wanted later, add
 * realistic, filter-aware handlers here and drive a REAL Supabase client
 * through them via `server.use(...)`.
 */
export const handlers = [];
