import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getProjectByIdMock = vi.fn();
const getProjectsMock = vi.fn();
vi.mock('@/lib/queries/projects', () => ({
  getProjectById: (...args: unknown[]) => getProjectByIdMock(...args),
  getProjects: (...args: unknown[]) => getProjectsMock(...args),
}));

import { generateMetadata } from '@/app/projects/[id]/page';

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';

function makeProject(description: string) {
  return {
    id: VALID_ID,
    title: 'My Project',
    description,
    github_url: null,
    live_url: null,
    demo_video_path: null,
    demo_video_poster_path: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    screenshots: [],
    technologies: [],
  };
}

function callMetadata(id: string) {
  return generateMetadata({ params: Promise.resolve({ id }) }) as Promise<{
    title?: string;
    description?: string;
  }>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('project detail generateMetadata', () => {
  it('returns the title and a Markdown-stripped description', async () => {
    getProjectByIdMock.mockResolvedValue(
      makeProject('# Heading\n\nA **bold** [link](https://x.com) intro.'),
    );

    const meta = await callMetadata(VALID_ID);

    expect(meta.title).toBe('My Project');
    expect(meta.description).toBe('Heading A bold link intro.');
    // No raw Markdown punctuation leaks into the social/search snippet.
    expect(meta.description).not.toMatch(/[#*]/);
    expect(meta.description).not.toContain('](');
  });

  it('truncates the (plain-text) description to 160 characters', async () => {
    getProjectByIdMock.mockResolvedValue(makeProject('x'.repeat(400)));

    const meta = await callMetadata(VALID_ID);

    expect(meta.description).toHaveLength(160);
  });

  it('returns empty metadata for a non-UUID id without querying', async () => {
    const meta = await callMetadata('not-a-uuid');

    expect(meta).toEqual({});
    expect(getProjectByIdMock).not.toHaveBeenCalled();
  });

  it('returns empty metadata when the project is not found', async () => {
    getProjectByIdMock.mockResolvedValue(null);

    const meta = await callMetadata(VALID_ID);

    expect(meta).toEqual({});
  });
});
