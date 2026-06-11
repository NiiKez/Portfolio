import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => { marker: string }>(() => ({
    marker: 'public-client',
  })),
);
vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('@/lib/env.client', () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  },
}));

import { createPublicClient } from '@/lib/supabase/public';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createPublicClient', () => {
  it('builds an anon client on the portfolio schema with no session', () => {
    const client = createPublicClient();

    expect(client).toEqual({ marker: 'public-client' });
    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createClientMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:54321');
    // The public client must use the anon key — it carries no session and must
    // never hold the service-role secret.
    expect(key).toBe('anon-key');
    expect(options).toEqual({
      db: { schema: 'portfolio' },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });
});
