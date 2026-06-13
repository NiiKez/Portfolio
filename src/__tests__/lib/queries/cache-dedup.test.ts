import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// A deterministic stand-in for React's request-scoped `cache()`. The real cache
// lives in the Server Components render context, which a unit test has no access
// to (there `cache()` is a passthrough — see queries/projects.test.ts, which run
// un-deduped). This memoizer reproduces the per-request behavior — same args
// within a request resolve to a single underlying call — so we can assert that
// the loaders are actually wrapped and dedup. `cacheStores` is the registry of
// every per-function store, which we clear between tests to model a fresh request.
const { cacheStores } = vi.hoisted(() => ({
  cacheStores: [] as Array<Map<string, unknown>>,
}));

vi.mock('react', () => ({
  cache: (fn: (...args: unknown[]) => unknown) => {
    const store = new Map<string, unknown>();
    cacheStores.push(store);
    return (...args: unknown[]) => {
      const key = JSON.stringify(args);
      if (!store.has(key)) store.set(key, fn(...args));
      return store.get(key);
    };
  },
}));

const fromMock = vi.fn();

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

import { getProjectById, getProjects } from '@/lib/queries/projects';
import { getExperiences } from '@/lib/queries/experience';
import { getSkills } from '@/lib/queries/skills';

type SupabaseResult = {
  data: unknown;
  error: { message: string } | null;
};

// .select().order().order() resolves (getProjects / getSkills / getExperiences).
function createListChain(result: SupabaseResult) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  let orderCalls = 0;
  chain.order = vi.fn(() => {
    orderCalls += 1;
    return orderCalls >= 2 ? Promise.resolve(result) : chain;
  });
  return chain;
}

// .select().eq().maybeSingle() resolves (getProjectById).
function createSingleChain(result: SupabaseResult) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  // A new request: the request-scoped caches are gone.
  cacheStores.forEach((store) => store.clear());
});

describe('query loaders are request-scoped cache()-deduped', () => {
  it('getProjects collapses repeat calls in one request to a single round-trip', async () => {
    fromMock.mockImplementation(() =>
      createListChain({ data: [], error: null }),
    );

    const [a, b] = await Promise.all([getProjects(), getProjects()]);

    expect(fromMock).toHaveBeenCalledTimes(1);
    // Same memoized promise → same resolved value reference.
    expect(a).toBe(b);
  });

  it('getProjectById dedups the same id but re-queries a different id', async () => {
    fromMock.mockImplementation(() =>
      createSingleChain({ data: null, error: null }),
    );

    // This is the real win: generateMetadata + the page component both load the
    // same project id within one request.
    await Promise.all([getProjectById('p1'), getProjectById('p1')]);
    expect(fromMock).toHaveBeenCalledTimes(1);

    // A distinct id is a distinct cache key, so it still queries.
    await getProjectById('p2');
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it('getSkills and getExperiences each dedup within a request', async () => {
    fromMock.mockImplementation(() =>
      createListChain({ data: [], error: null }),
    );

    await Promise.all([getSkills(), getSkills()]);
    await Promise.all([getExperiences(), getExperiences()]);

    // One round-trip for skills + one for experiences, not four.
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache across requests (re-queries after the request ends)', async () => {
    fromMock.mockImplementation(() =>
      createSingleChain({ data: null, error: null }),
    );

    await getProjectById('p1');
    expect(fromMock).toHaveBeenCalledTimes(1);

    // Simulate the next request: the per-request cache no longer exists, so the
    // loader hits the DB again — this is why the fix stays compatible with the
    // per-request nonce CSP / force-dynamic model (no stale cross-request cache).
    cacheStores.forEach((store) => store.clear());
    vi.clearAllMocks();
    fromMock.mockImplementation(() =>
      createSingleChain({ data: null, error: null }),
    );

    await getProjectById('p1');
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
