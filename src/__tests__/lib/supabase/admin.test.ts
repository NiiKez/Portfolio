import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const createClientMock = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => { marker: string }>(() => ({
    marker: 'admin-client',
  })),
);
vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    ADMIN_EMAIL: 'admin@example.com',
  },
}));

import { createAdminClient } from '@/lib/supabase/admin';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createAdminClient', () => {
  it('builds a service-role client on the portfolio schema with no session', () => {
    const client = createAdminClient();

    expect(client).toEqual({ marker: 'admin-client' });
    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createClientMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:54321');
    // Security-critical: the admin client must use the service-role key,
    // never the anon key.
    expect(key).toBe('service-role-key');
    expect(key).not.toBe('anon-key');
    expect(options).toEqual({
      db: { schema: 'portfolio' },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });
});
