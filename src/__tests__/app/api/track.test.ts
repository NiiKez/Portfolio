import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rateLimitMock = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
}));

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

const getUserMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: getUserMock } }),
}));

const isAdminEmailMock = vi.fn();
vi.mock('@/lib/admin-email', () => ({
  isAdminEmail: (...args: unknown[]) => isAdminEmailMock(...args),
}));

const isPublishedProjectMock = vi.fn();
vi.mock('@/lib/queries/projects', () => ({
  isPublishedProject: (...args: unknown[]) => isPublishedProjectMock(...args),
}));

import { POST } from '@/app/api/track/route';

const UUID = '9712e2a6-e7b8-49fa-a82d-912c70e85c28';

function makeRequest(
  body: string | null,
  headers: Record<string, string> = {},
) {
  const request = new NextRequest('http://localhost:3000/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ?? undefined,
  });
  const merged: Record<string, string> = {
    'x-forwarded-for': '1.2.3.4',
    origin: 'http://localhost:3000',
    host: 'localhost:3000',
    ...headers,
  };
  for (const [name, value] of Object.entries(merged)) {
    request.headers.set(name, value);
  }
  return request;
}

// Attach a Supabase session cookie so the route runs its admin-exclusion lookup
// (it is skipped unless an `sb-*` cookie is present).
function withSession(request: NextRequest) {
  request.cookies.set('sb-portfolio-auth-token', 'fake-session');
  return request;
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockReturnValue({ allowed: true, retryAfter: 0 });
  insertMock.mockResolvedValue({ error: null });
  getUserMock.mockResolvedValue({ data: { user: null } });
  isAdminEmailMock.mockReturnValue(false);
  isPublishedProjectMock.mockResolvedValue(true);
});

describe('POST /api/track', () => {
  it('returns 403 when the Origin header is missing (cross-site guard)', async () => {
    const request = new NextRequest('http://localhost:3000/api/track', {
      method: 'POST',
      body: JSON.stringify({ path: '/' }),
    });
    request.headers.set('host', 'localhost:3000'); // origin omitted

    const res = await POST(request);

    expect(res.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns 403 when the Origin host does not match Host', async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ path: '/' }), {
        origin: 'https://evil.example',
      }),
    );

    expect(res.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('accepts the beacon when Host carries an explicit port but Origin does not', async () => {
    // A proxy can forward `Host: site:443` against a port-less `Origin` host;
    // the same-origin guard must compare bare hostnames, not 403 every beacon.
    const res = await POST(
      makeRequest(JSON.stringify({ path: '/' }), {
        origin: 'https://fatihoncu.me',
        host: 'fatihoncu.me:443',
      }),
    );

    expect(res.status).toBe(204);
    expect(fromMock).toHaveBeenCalledWith('page_views');
  });

  it('accepts the beacon when Host is mixed-case versus a lowercase Origin host', async () => {
    // `Origin` parses to a lowercased hostname; a proxy may forward a mixed-case
    // `Host`. The guard must compare case-insensitively, else it 403s every beacon.
    const res = await POST(
      makeRequest(JSON.stringify({ path: '/' }), {
        origin: 'https://fatihoncu.me',
        host: 'FatihOncu.me',
      }),
    );

    expect(res.status).toBe(204);
    expect(fromMock).toHaveBeenCalledWith('page_views');
  });

  it('returns 403 (not a 500) when the Origin header is present but unparseable', async () => {
    // Browsers send `Origin: null` for opaque origins; a naive `new URL()`
    // would throw and surface as a 500 / error oracle.
    const res = await POST(
      makeRequest(JSON.stringify({ path: '/' }), { origin: 'null' }),
    );

    expect(res.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns 429 with Retry-After when rate limited', async () => {
    rateLimitMock.mockReturnValue({ allowed: false, retryAfter: 30 });

    const res = await POST(makeRequest(JSON.stringify({ path: '/' })));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('keys the rate limit on the trusted rightmost x-forwarded-for IP', async () => {
    await POST(
      makeRequest(JSON.stringify({ path: '/' }), {
        'x-forwarded-for': '9.9.9.9, 10.0.0.1',
      }),
    );

    expect(rateLimitMock).toHaveBeenCalledWith('track:10.0.0.1', 60, 60 * 1000);
  });

  it('keys the rate limit on track:unknown when no x-forwarded-for is present', async () => {
    const request = makeRequest(JSON.stringify({ path: '/' }));
    request.headers.delete('x-forwarded-for');

    await POST(request);

    expect(rateLimitMock).toHaveBeenCalledWith('track:unknown', 60, 60 * 1000);
  });

  it('records a valid page view and returns 204', async () => {
    const res = await POST(makeRequest(JSON.stringify({ path: '/projects' })));

    expect(res.status).toBe(204);
    expect(fromMock).toHaveBeenCalledWith('page_views');
    expect(insertMock).toHaveBeenCalledWith({
      path: '/projects',
      referrer: null,
    });
  });

  it('stores the bare referrer host and strips the query string from the path', async () => {
    await POST(
      makeRequest(
        JSON.stringify({
          path: '/projects?utm_source=hn',
          referrer: 'https://news.ycombinator.com/item?id=42',
        }),
      ),
    );

    expect(insertMock).toHaveBeenCalledWith({
      path: '/projects',
      referrer: 'news.ycombinator.com',
    });
  });

  it('drops a same-host (internal navigation) referrer', async () => {
    await POST(
      makeRequest(
        JSON.stringify({
          path: '/about',
          referrer: 'http://localhost:3000/projects',
        }),
      ),
    );

    expect(insertMock).toHaveBeenCalledWith({
      path: '/about',
      referrer: null,
    });
  });

  it('silently drops an unparseable body without inserting (204)', async () => {
    const res = await POST(makeRequest('not json'));

    expect(res.status).toBe(204);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("does not record the admin's own page view, even on a public path", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: 'admin@example.com' } },
    });
    isAdminEmailMock.mockReturnValue(true);

    const res = await POST(
      withSession(makeRequest(JSON.stringify({ path: '/projects' }))),
    );

    expect(res.status).toBe(204);
    expect(isAdminEmailMock).toHaveBeenCalledWith('admin@example.com');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('records a non-admin authenticated visitor', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: 'someone@else.com' } },
    });
    isAdminEmailMock.mockReturnValue(false);

    const res = await POST(
      withSession(makeRequest(JSON.stringify({ path: '/projects' }))),
    );

    expect(res.status).toBe(204);
    expect(fromMock).toHaveBeenCalledWith('page_views');
  });

  it('skips the auth lookup entirely when no Supabase session cookie is present', async () => {
    const res = await POST(makeRequest(JSON.stringify({ path: '/projects' })));

    expect(res.status).toBe(204);
    expect(getUserMock).not.toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith('page_views');
  });

  it('fails open (records) when the admin auth lookup throws', async () => {
    getUserMock.mockRejectedValue(new Error('auth server down'));

    const res = await POST(
      withSession(makeRequest(JSON.stringify({ path: '/projects' }))),
    );

    expect(res.status).toBe(204);
    expect(fromMock).toHaveBeenCalledWith('page_views');
  });

  it('silently drops a non-trackable (admin) path without inserting', async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ path: '/admin/projects' })),
    );

    expect(res.status).toBe(204);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('drops a request with a bot/scanner User-Agent without inserting', async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ path: '/' }), {
        'user-agent': 'curl/8.6.0',
      }),
    );

    expect(res.status).toBe(204);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('records a request from a normal browser User-Agent', async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ path: '/' }), {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      }),
    );

    expect(res.status).toBe(204);
    expect(fromMock).toHaveBeenCalledWith('page_views');
  });

  it('drops a path outside the known route shape (scanner probe)', async () => {
    const res = await POST(makeRequest(JSON.stringify({ path: '/cmd_sco' })));

    expect(res.status).toBe(204);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('records a project-detail view when the project exists and is published', async () => {
    isPublishedProjectMock.mockResolvedValue(true);

    const res = await POST(
      makeRequest(JSON.stringify({ path: `/projects/${UUID}` })),
    );

    expect(res.status).toBe(204);
    expect(isPublishedProjectMock).toHaveBeenCalledWith(UUID);
    expect(insertMock).toHaveBeenCalledWith({
      path: `/projects/${UUID}`,
      referrer: null,
    });
  });

  it('drops a project-detail view at a nonexistent id (e.g. the all-zeros UUID)', async () => {
    isPublishedProjectMock.mockResolvedValue(false);

    const res = await POST(
      makeRequest(
        JSON.stringify({
          path: '/projects/00000000-0000-4000-8000-000000000000',
        }),
      ),
    );

    expect(res.status).toBe(204);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('fails open (records) when the project existence lookup throws', async () => {
    isPublishedProjectMock.mockRejectedValue(new Error('db down'));

    const res = await POST(
      makeRequest(JSON.stringify({ path: `/projects/${UUID}` })),
    );

    expect(res.status).toBe(204);
    expect(fromMock).toHaveBeenCalledWith('page_views');
  });

  it('swallows a storage failure and still returns 204', async () => {
    insertMock.mockRejectedValue(new Error('db down'));

    const res = await POST(makeRequest(JSON.stringify({ path: '/' })));

    expect(res.status).toBe(204);
    expect(insertMock).toHaveBeenCalled();
  });

  it('returns 204 and logs server-side when the insert resolves with a DB error', async () => {
    // PostgREST resolves with `{ error }` rather than throwing, so the route
    // must surface it to the server log (never to the visitor) and still 204.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    insertMock.mockResolvedValue({ error: { message: 'relation missing' } });

    const res = await POST(makeRequest(JSON.stringify({ path: '/' })));

    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('insert failed'),
      'relation missing',
    );
    warn.mockRestore();
  });
});
