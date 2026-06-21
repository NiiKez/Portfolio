import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getProjectByIdMock = vi.fn();
const getProjectsMock = vi.fn();
vi.mock('@/lib/queries/projects', () => ({
  getProjectById: (...args: unknown[]) => getProjectByIdMock(...args),
  getProjects: (...args: unknown[]) => getProjectsMock(...args),
}));

// `notFound()` throws a sentinel so we can assert the page reached that branch
// (mirrors Next.js, where notFound() throws to unwind to the 404 boundary).
const NOT_FOUND = 'NEXT_NOT_FOUND';
const notFoundMock = vi.fn(() => {
  throw new Error(NOT_FOUND);
});
vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

import ProjectDetailPage, { generateMetadata } from '@/app/projects/[id]/page';

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
    is_published: true,
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

  it('strips raw HTML out of the description so no tags leak into the snippet', async () => {
    getProjectByIdMock.mockResolvedValue(
      makeProject('<script>alert(1)</script> Real summary text.'),
    );

    const meta = await callMetadata(VALID_ID);

    expect(meta.description).toContain('Real summary text.');
    // The hardening flows through to the meta description: no angle brackets.
    expect(meta.description).not.toContain('<');
    expect(meta.description).not.toContain('>');
    expect(meta.description).not.toContain('alert(1)');
  });
});

describe('ProjectDetailPage notFound branches', () => {
  it('calls notFound() for a non-UUID id without querying', async () => {
    await expect(
      ProjectDetailPage({ params: Promise.resolve({ id: 'not-a-uuid' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getProjectByIdMock).not.toHaveBeenCalled();
  });

  it('calls notFound() when the project is null', async () => {
    getProjectByIdMock.mockResolvedValue(null);

    await expect(
      ProjectDetailPage({ params: Promise.resolve({ id: VALID_ID }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(getProjectByIdMock).toHaveBeenCalledWith(VALID_ID);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
