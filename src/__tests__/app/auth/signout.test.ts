import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    ADMIN_EMAIL: 'admin@example.com',
  },
}));

const signOut = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { signOut },
  })),
}));

import { POST } from '@/app/auth/signout/route';

function postRequest(headers: Record<string, string>) {
  // `origin`/`host` are forbidden request headers and are dropped when passed
  // via the constructor's `headers` option, so set them after construction.
  const request = new NextRequest('http://localhost:3000/auth/signout', {
    method: 'POST',
  });
  for (const [name, value] of Object.entries(headers)) {
    request.headers.set(name, value);
  }
  return request;
}

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue({ error: null });
});

describe('POST /auth/signout', () => {
  it('rejects a request with no origin header (403) and does not sign out', async () => {
    const response = await POST(postRequest({ host: 'localhost:3000' }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(signOut).not.toHaveBeenCalled();
  });

  it('rejects a request with no host header (403)', async () => {
    const response = await POST(
      postRequest({ origin: 'http://localhost:3000' }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(signOut).not.toHaveBeenCalled();
  });

  it('rejects a cross-origin request where origin host differs from host (403)', async () => {
    const response = await POST(
      postRequest({ origin: 'https://evil.com', host: 'localhost:3000' }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs out and redirects to /admin/login when origin and host match', async () => {
    const response = await POST(
      postRequest({ origin: 'http://localhost:3000', host: 'localhost:3000' }),
    );

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') as string);
    expect(location.host).toBe('localhost:3000');
    expect(location.pathname).toBe('/admin/login');
  });
});
