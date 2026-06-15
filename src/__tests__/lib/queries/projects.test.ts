import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const fromMock = vi.fn();

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

import {
  getFeaturedProjects,
  getProjectById,
  getProjects,
} from '@/lib/queries/projects';

type SupabaseResult = {
  data: unknown;
  error: { message: string } | null;
};

// Chain for getProjects: .select().order().order() resolves.
function createListChain(result: SupabaseResult) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  let orderCalls = 0;
  chain.order = vi.fn(() => {
    orderCalls += 1;
    // The second .order() is terminal and resolves to the result.
    return orderCalls >= 2 ? Promise.resolve(result) : chain;
  });
  return chain;
}

// Chain for getProjectById: .select().eq().maybeSingle() resolves.
function createSingleChain(result: SupabaseResult) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  return chain;
}

// Chain for getFeaturedProjects: .select().order().order().limit() resolves.
function createFeaturedChain(result: SupabaseResult) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(async () => result);
  return chain;
}

const baseProjectRow = {
  id: 'p1',
  title: 'Project One',
  description: 'desc',
  github_url: null,
  live_url: null,
  demo_video_path: null,
  demo_video_poster_path: null,
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const skillA = {
  id: 's1',
  name: 'TypeScript',
  category: 'lang',
  proficiency: 'advanced',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getProjects', () => {
  it('maps multiple rows and sorts screenshots by sort_order ascending', async () => {
    const rows = [
      {
        ...baseProjectRow,
        id: 'p1',
        screenshots: [
          {
            id: 'b',
            project_id: 'p1',
            storage_path: 'b',
            alt_text: null,
            sort_order: 2,
            created_at: '',
          },
          {
            id: 'a',
            project_id: 'p1',
            storage_path: 'a',
            alt_text: null,
            sort_order: 0,
            created_at: '',
          },
          {
            id: 'c',
            project_id: 'p1',
            storage_path: 'c',
            alt_text: null,
            sort_order: 1,
            created_at: '',
          },
        ],
        project_technologies: [{ skills: skillA }],
      },
      {
        ...baseProjectRow,
        id: 'p2',
        screenshots: [],
        project_technologies: [],
      },
    ];
    fromMock.mockReturnValue(createListChain({ data: rows, error: null }));

    const result = await getProjects();

    expect(fromMock).toHaveBeenCalledWith('projects');
    expect(result).toHaveLength(2);
    expect(result[0]!.screenshots.map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(result[0]!.technologies).toEqual([skillA]);
    expect(result[1]!.screenshots).toEqual([]);
    expect(result[1]!.technologies).toEqual([]);
  });

  it('returns empty arrays when screenshots and project_technologies are null', async () => {
    const rows = [
      {
        ...baseProjectRow,
        screenshots: null,
        project_technologies: null,
      },
    ];
    fromMock.mockReturnValue(createListChain({ data: rows, error: null }));

    const result = await getProjects();

    expect(result[0]!.screenshots).toEqual([]);
    expect(result[0]!.technologies).toEqual([]);
  });

  it('sorts technologies by skill sort_order (then name), regardless of embed order', async () => {
    const skillZebra = { ...skillA, id: 's-z', name: 'Zebra', sort_order: 2 };
    const skillAlpha = { ...skillA, id: 's-a', name: 'Alpha', sort_order: 0 };
    const skillMid = { ...skillA, id: 's-m', name: 'Mid', sort_order: 1 };
    const rows = [
      {
        ...baseProjectRow,
        screenshots: [],
        // Embedded relation comes back in arbitrary order — PostgREST gives no
        // guarantee without an explicit order, so mapRow must sort it.
        project_technologies: [
          { skills: skillZebra },
          { skills: skillMid },
          { skills: skillAlpha },
        ],
      },
    ];
    fromMock.mockReturnValue(createListChain({ data: rows, error: null }));

    const result = await getProjects();

    expect(result[0]!.technologies.map((t) => t.id)).toEqual([
      's-a',
      's-m',
      's-z',
    ]);
  });

  it('breaks sort_order ties by skill name', async () => {
    const skillB = { ...skillA, id: 's-b', name: 'Beta', sort_order: 5 };
    const skillC = { ...skillA, id: 's-c', name: 'Alpha', sort_order: 5 };
    const rows = [
      {
        ...baseProjectRow,
        screenshots: [],
        project_technologies: [{ skills: skillB }, { skills: skillC }],
      },
    ];
    fromMock.mockReturnValue(createListChain({ data: rows, error: null }));

    const result = await getProjects();

    expect(result[0]!.technologies.map((t) => t.name)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('filters out null skills inside project_technologies', async () => {
    const rows = [
      {
        ...baseProjectRow,
        screenshots: [],
        project_technologies: [
          { skills: null },
          { skills: skillA },
          { skills: null },
        ],
      },
    ];
    fromMock.mockReturnValue(createListChain({ data: rows, error: null }));

    const result = await getProjects();

    expect(result[0]!.technologies).toEqual([skillA]);
  });

  it('throws when supabase returns an error', async () => {
    fromMock.mockReturnValue(
      createListChain({ data: null, error: { message: 'boom' } }),
    );

    await expect(getProjects()).rejects.toEqual({ message: 'boom' });
  });
});

describe('getProjectById', () => {
  it('returns null when maybeSingle returns null data', async () => {
    fromMock.mockReturnValue(createSingleChain({ data: null, error: null }));

    const result = await getProjectById('p1');

    expect(result).toBeNull();
  });

  it('maps a single row', async () => {
    const row = {
      ...baseProjectRow,
      demo_video_path: 'p1/demo.mp4',
      screenshots: [
        {
          id: 'b',
          project_id: 'p1',
          storage_path: 'b',
          alt_text: null,
          sort_order: 1,
          created_at: '',
        },
        {
          id: 'a',
          project_id: 'p1',
          storage_path: 'a',
          alt_text: null,
          sort_order: 0,
          created_at: '',
        },
      ],
      project_technologies: [{ skills: skillA }],
    };
    fromMock.mockReturnValue(createSingleChain({ data: row, error: null }));

    const result = await getProjectById('p1');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('p1');
    expect(result?.demo_video_path).toBe('p1/demo.mp4');
    expect(result?.screenshots.map((s) => s.id)).toEqual(['a', 'b']);
    expect(result?.technologies).toEqual([skillA]);
  });

  it('throws when supabase returns an error', async () => {
    fromMock.mockReturnValue(
      createSingleChain({ data: null, error: { message: 'nope' } }),
    );

    await expect(getProjectById('p1')).rejects.toEqual({ message: 'nope' });
  });
});

describe('getFeaturedProjects', () => {
  it('bounds the query with a server-side limit (default 2) and maps rows', async () => {
    const chain = createFeaturedChain({
      data: [{ ...baseProjectRow, screenshots: [], project_technologies: [] }],
      error: null,
    });
    fromMock.mockReturnValue(chain);

    const result = await getFeaturedProjects();

    expect(fromMock).toHaveBeenCalledWith('projects');
    expect(chain.limit).toHaveBeenCalledWith(2);
    expect(result).toHaveLength(1);
    expect(result[0]!.screenshots).toEqual([]);
    expect(result[0]!.technologies).toEqual([]);
  });

  it('forwards a custom limit to the query', async () => {
    const chain = createFeaturedChain({ data: [], error: null });
    fromMock.mockReturnValue(chain);

    await getFeaturedProjects(5);

    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it('reuses mapRow so screenshots/technologies are sorted by sort_order', async () => {
    const chain = createFeaturedChain({
      data: [
        {
          ...baseProjectRow,
          screenshots: [
            {
              id: 'b',
              project_id: 'p1',
              storage_path: 'b',
              alt_text: null,
              sort_order: 1,
              created_at: '',
            },
            {
              id: 'a',
              project_id: 'p1',
              storage_path: 'a',
              alt_text: null,
              sort_order: 0,
              created_at: '',
            },
          ],
          project_technologies: [{ skills: skillA }],
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(chain);

    const result = await getFeaturedProjects(2);

    expect(result[0]!.screenshots.map((s) => s.id)).toEqual(['a', 'b']);
    expect(result[0]!.technologies).toEqual([skillA]);
  });

  it('returns an empty array when there are no projects', async () => {
    fromMock.mockReturnValue(createFeaturedChain({ data: [], error: null }));

    await expect(getFeaturedProjects()).resolves.toEqual([]);
  });

  it('throws when supabase returns an error', async () => {
    fromMock.mockReturnValue(
      createFeaturedChain({ data: null, error: { message: 'kaboom' } }),
    );

    await expect(getFeaturedProjects()).rejects.toEqual({ message: 'kaboom' });
  });
});
