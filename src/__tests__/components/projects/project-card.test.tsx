import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProjectCard } from '@/components/projects/project-card';
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

const baseProject: ProjectWithDetails = {
  id: 'project-1',
  title: 'Portfolio',
  description: 'A short description of the project.',
  github_url: 'https://github.com/me/portfolio',
  live_url: null,
  demo_video_path: null,
  demo_video_poster_path: null,
  is_published: true,
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  screenshots: [],
  technologies: [makeSkill('s1', 'TypeScript'), makeSkill('s2', 'React')],
};

describe('ProjectCard', () => {
  it('renders the project title and description', () => {
    render(<ProjectCard project={baseProject} />);

    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(
      screen.getByText('A short description of the project.'),
    ).toBeInTheDocument();
  });

  it('links to the public project detail page', () => {
    render(<ProjectCard project={baseProject} />);

    const link = screen.getByRole('link', { name: /Portfolio/ });
    expect(link).toHaveAttribute('href', '/projects/project-1');
  });

  it('renders a badge for each technology', () => {
    render(<ProjectCard project={baseProject} />);

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('renders no technology badges when the list is empty', () => {
    render(<ProjectCard project={{ ...baseProject, technologies: [] }} />);

    expect(screen.queryByText('TypeScript')).not.toBeInTheDocument();
  });

  it('truncates descriptions longer than 160 characters with an ellipsis', () => {
    const longDescription = 'a'.repeat(200);
    render(
      <ProjectCard
        project={{ ...baseProject, description: longDescription }}
      />,
    );

    const expected = 'a'.repeat(157) + '…';
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(longDescription)).not.toBeInTheDocument();
  });

  it('renders descriptions up to 160 characters without truncation', () => {
    const exact = 'b'.repeat(160);
    render(<ProjectCard project={{ ...baseProject, description: exact }} />);

    expect(screen.getByText(exact)).toBeInTheDocument();
  });

  it('renders a screenshot image when the project has one', () => {
    render(
      <ProjectCard
        project={{
          ...baseProject,
          screenshots: [
            {
              id: 'sc1',
              project_id: 'project-1',
              storage_path: 'project-1/hero.png',
              alt_text: 'Hero shot',
              sort_order: 0,
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        }}
      />,
    );

    const img = screen.getByRole('img', { name: 'Hero shot' });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain('project-1%2Fhero.png');
  });

  it('falls back to the project title as alt text when none is provided', () => {
    render(
      <ProjectCard
        project={{
          ...baseProject,
          screenshots: [
            {
              id: 'sc1',
              project_id: 'project-1',
              storage_path: 'project-1/hero.png',
              alt_text: null,
              sort_order: 0,
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('img', { name: 'Portfolio' })).toBeInTheDocument();
  });

  it('shows a Demo badge when the project has a demo video', () => {
    render(
      <ProjectCard
        project={{ ...baseProject, demo_video_path: 'project-1/demo.mp4' }}
      />,
    );

    expect(screen.getByText('Demo')).toBeInTheDocument();
  });

  it('does not show a Demo badge when there is no demo video', () => {
    render(<ProjectCard project={baseProject} />);

    expect(screen.queryByText('Demo')).not.toBeInTheDocument();
  });
});
