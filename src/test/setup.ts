import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach, beforeAll } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.ADMIN_EMAIL ??= 'admin@example.com';

import { server } from './mocks/server';

// The MSW server runs with no handlers — it exists only as a network tripwire
// (`onUnhandledRequest: 'error'`) so an unmocked request fails loudly instead of
// reaching the live shared Supabase project. See src/test/mocks/handlers.ts.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => server.close());
