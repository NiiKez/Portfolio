import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach, beforeAll } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.ADMIN_EMAIL ??= 'admin@example.com';

import { server } from './mocks/server';
import { resetMockData } from './mocks/handlers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  server.resetHandlers();
  resetMockData();
});

afterAll(() => server.close());
