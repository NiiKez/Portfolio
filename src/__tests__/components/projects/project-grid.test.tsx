import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ProjectGrid } from '@/components/projects/project-grid';
import type { ProjectWithDetails, Skill } from '@/types';

const makeSkill = (id: string, name: string): Skill => ({
  id,
  name,
  category: 'Languages',
  proficiency: 'advanced',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const makeProject = (
  id: string,
  title: string,
  technologies: Skill[],
): ProjectWithDetails => ({
  id,
  title,
  description: `${title} description`,
  github_url: null,
  live_url: null,
  demo_video_path: null,
  demo_video_poster_path: null,
  is_published: true,
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  screenshots: [],
  technologies,
});

const typescript = makeSkill('s1', 'TypeScript');
const react = makeSkill('s2', 'React');
const go = makeSkill('s3', 'Go');

const projects: ProjectWithDetails[] = [
  makeProject('p1', 'Portfolio', [typescript, react]),
  makeProject('p2', 'CLI Tool', [go]),
  makeProject('p3', 'Docs Site', [typescript]),
];

describe('ProjectGrid', () => {
  it('renders every project by default', () => {
    render(<ProjectGrid projects={projects} />);

    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('CLI Tool')).toBeInTheDocument();
    expect(screen.getByText('Docs Site')).toBeInTheDocument();
  });

  it('renders an "All" button plus one button per unique technology', () => {
    render(<ProjectGrid projects={projects} />);

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'TypeScript' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'React' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('filters projects to those that include the selected technology', async () => {
    const user = userEvent.setup();
    render(<ProjectGrid projects={projects} />);

    await user.click(screen.getByRole('button', { name: 'TypeScript' }));

    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Docs Site')).toBeInTheDocument();
    expect(screen.queryByText('CLI Tool')).not.toBeInTheDocument();
  });

  it('toggles the active technology off when clicked a second time', async () => {
    const user = userEvent.setup();
    render(<ProjectGrid projects={projects} />);

    const goButton = screen.getByRole('button', { name: 'Go' });
    await user.click(goButton);
    await user.click(goButton);

    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('CLI Tool')).toBeInTheDocument();
    expect(screen.getByText('Docs Site')).toBeInTheDocument();
  });

  it('restores all projects when the "All" button is pressed after filtering', async () => {
    const user = userEvent.setup();
    render(<ProjectGrid projects={projects} />);

    await user.click(screen.getByRole('button', { name: 'Go' }));
    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('CLI Tool')).toBeInTheDocument();
    expect(screen.getByText('Docs Site')).toBeInTheDocument();
  });

  it('keeps the matching project visible after activating its technology filter', async () => {
    // Every filter pill is derived from the technologies of the projects in the
    // list, so activating any pill always leaves at least the project(s) that
    // own that tech visible. The filtered-to-zero "No projects found." branch
    // is therefore unreachable through the UI (only the empty-list case below
    // reaches it). This test honestly asserts that "still matches" behaviour.
    const user = userEvent.setup();
    render(
      <ProjectGrid projects={[makeProject('p1', 'Portfolio', [typescript])]} />,
    );

    await user.click(screen.getByRole('button', { name: 'TypeScript' }));

    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.queryByText('No projects found.')).not.toBeInTheDocument();
  });

  it('shows an empty state when the project list is empty', () => {
    render(<ProjectGrid projects={[]} />);

    expect(screen.getByText('No projects found.')).toBeInTheDocument();
  });

  it('does not render the filter bar when no projects have technologies', () => {
    render(<ProjectGrid projects={[makeProject('p1', 'Portfolio', [])]} />);

    expect(
      screen.queryByRole('group', { name: 'Filter by technology' }),
    ).not.toBeInTheDocument();
  });

  it('strips markdown from the description preview down to plain text', () => {
    const markdown = [
      '# Project Heading',
      '',
      'A **bold** intro with a [link](https://example.com) and `inline code`.',
      '',
      '```ts',
      'const secret = "should not appear";',
      '```',
      '',
      '- first bullet',
      '- second bullet',
      '',
      '1. numbered item',
      '> a quote',
    ].join('\n');

    const project: ProjectWithDetails = {
      ...makeProject('p1', 'Markdown Project', [typescript]),
      description: markdown,
    };
    render(<ProjectGrid projects={[project]} />);

    const preview = screen.getByText(/A bold intro/i);
    const text = preview.textContent ?? '';

    // Heading marker, emphasis markers, link syntax, list/quote markers removed.
    expect(text).toContain('Project Heading');
    expect(text).toContain('A bold intro with a link and inline code.');
    expect(text).toContain('first bullet');
    expect(text).toContain('numbered item');
    expect(text).toContain('a quote');
    // Fenced code block contents are dropped entirely.
    expect(text).not.toContain('should not appear');
    // No raw markdown punctuation survives.
    expect(text).not.toMatch(/[#*`>]/);
    expect(text).not.toContain('](');
    expect(text).not.toContain('- ');
  });

  it('renders a GitHub link when the project has a github_url', () => {
    const withRepo: ProjectWithDetails = {
      ...makeProject('p1', 'Portfolio', [typescript]),
      github_url: 'https://github.com/me/portfolio',
    };
    render(<ProjectGrid projects={[withRepo]} />);

    const githubLink = screen.getByRole('link', {
      name: 'Portfolio on GitHub',
    });
    expect(githubLink).toHaveAttribute(
      'href',
      'https://github.com/me/portfolio',
    );
  });

  it('makes the project title a link to the detail page', () => {
    render(
      <ProjectGrid projects={[makeProject('p1', 'Portfolio', [typescript])]} />,
    );

    const titleLink = screen.getByRole('link', { name: 'Portfolio' });
    expect(titleLink).toHaveAttribute('href', '/projects/p1');
  });

  it('renders a live-site link when the project has a live_url', () => {
    const withLive: ProjectWithDetails = {
      ...makeProject('p1', 'Portfolio', [typescript]),
      live_url: 'https://portfolio.example.com',
    };
    render(<ProjectGrid projects={[withLive]} />);

    const liveLink = screen.getByRole('link', {
      name: 'Portfolio live site',
    });
    expect(liveLink).toHaveAttribute('href', 'https://portfolio.example.com');
    expect(liveLink).toHaveAttribute('target', '_blank');
  });

  it('shows the hovered project preview with its screenshot', async () => {
    const withShot: ProjectWithDetails = {
      ...makeProject('p1', 'Portfolio', [typescript]),
      github_url: 'https://github.com/me/portfolio',
      screenshots: [
        {
          id: 'sc1',
          project_id: 'p1',
          storage_path: 'p1/hero.png',
          alt_text: 'Hero',
          sort_order: 0,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    };
    render(<ProjectGrid projects={[withShot]} />);

    const detailLink = screen.getByRole('link', { name: 'Portfolio' });
    await act(async () => {
      detailLink.focus();
    });

    const img = await screen.findByRole('img', { name: 'Hero' });
    expect(img.getAttribute('src')).toContain('p1%2Fhero.png');
  });

  it('renders the gradient fallback preview for a focused project without screenshots', async () => {
    render(<ProjectGrid projects={projects} />);

    const detailLink = screen.getByRole('link', { name: 'Portfolio' });
    await act(async () => {
      detailLink.focus();
    });

    expect(screen.queryByText('Hover a project')).not.toBeInTheDocument();
  });
});
