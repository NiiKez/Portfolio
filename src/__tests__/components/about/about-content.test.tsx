import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Experience, Skill } from '@/types';

// AboutContent reads the intro bio from the @/lib/profile module (not props),
// so we mock that module behind a mutable holder we can rewrite per test to
// exercise the filled-in vs. placeholder ("TODO") branches. Experience and
// skills come in as props.
type ProfileLike = { about: string };
const profileState: { profile: ProfileLike } = {
  profile: { about: 'TODO: placeholder bio' },
};

vi.mock('@/lib/profile', () => ({
  get profile() {
    return profileState.profile;
  },
}));

import { AboutContent } from '@/components/about/about-content';

const makeSkill = (id: string, name: string, category: string): Skill => ({
  id,
  name,
  category,
  proficiency: 'advanced',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const makeExperience = (overrides: Partial<Experience> = {}): Experience => ({
  id: '11111111-1111-4111-8111-111111111111',
  role: 'Software Engineer',
  company: 'Acme Corp',
  company_url: 'https://acme.example.com',
  location: 'Berlin, Germany',
  period: 'Jan 2024 – Dec 2024',
  kind: 'Full-time',
  description: 'Built the thing\n\nShipped the other thing',
  technologies: ['TypeScript', 'React'],
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  profileState.profile = {
    about: 'I am a developer who loves building things.',
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AboutContent', () => {
  it('renders the intro narrative when the bio is filled in', () => {
    render(<AboutContent skills={[]} experiences={[]} />);

    expect(
      screen.getByText('I am a developer who loves building things.'),
    ).toBeInTheDocument();
  });

  it('hides the intro narrative when the bio still starts with "TODO"', () => {
    profileState.profile = { about: 'TODO: write something here' };
    render(<AboutContent skills={[]} experiences={[]} />);

    expect(screen.queryByText(/TODO/)).not.toBeInTheDocument();
  });

  it('renders the Experience section with filled-in entries', () => {
    render(<AboutContent skills={[]} experiences={[makeExperience()]} />);

    expect(
      screen.getByRole('heading', { name: 'Experience' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Software Engineer' }),
    ).toBeInTheDocument();

    const companyLink = screen.getByRole('link', { name: /Acme Corp/ });
    expect(companyLink).toHaveAttribute('href', 'https://acme.example.com');

    // Blank-line-separated blocks render as bullet points, one per block.
    expect(screen.getByText('Built the thing')).toBeInTheDocument();
    expect(screen.getByText('Shipped the other thing')).toBeInTheDocument();
    expect(screen.getByText('Berlin, Germany')).toBeInTheDocument();
    expect(screen.getByText('Full-time')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('renders a paragraph description and a plain company name when no URL is given', () => {
    render(
      <AboutContent
        skills={[]}
        experiences={[
          makeExperience({
            role: 'Intern',
            company: 'No Link Co',
            company_url: null,
            description: 'A single paragraph describing the internship.',
            technologies: [],
          }),
        ]}
      />,
    );

    expect(
      screen.getByText('A single paragraph describing the internship.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /No Link Co/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('No Link Co')).toBeInTheDocument();
  });

  it('hides the Experience section when there are no entries', () => {
    render(<AboutContent skills={[]} experiences={[]} />);

    expect(
      screen.queryByRole('heading', { name: 'Experience' }),
    ).not.toBeInTheDocument();
  });

  it('groups skills by category under the tech-stack section', () => {
    const skills = [
      makeSkill('1', 'React', 'Frontend'),
      makeSkill('2', 'Tailwind', 'Frontend'),
      makeSkill('3', 'PostgreSQL', 'Backend'),
    ];
    render(<AboutContent skills={skills} experiences={[]} />);

    expect(
      screen.getByRole('heading', { name: 'Technologies I work with' }),
    ).toBeInTheDocument();

    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Tailwind')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
  });

  it('hides the tech-stack section when there are no skills', () => {
    render(<AboutContent skills={[]} experiences={[]} />);

    expect(
      screen.queryByRole('heading', { name: 'Technologies I work with' }),
    ).not.toBeInTheDocument();
  });

  it('renders multiple technology tags scoped to the experience entry', () => {
    render(
      <AboutContent
        skills={[]}
        experiences={[makeExperience({ technologies: ['Go', 'Rust'] })]}
      />,
    );

    const experienceSection = screen
      .getByRole('heading', { name: 'Experience' })
      .closest('section') as HTMLElement;
    expect(within(experienceSection).getByText('Go')).toBeInTheDocument();
    expect(within(experienceSection).getByText('Rust')).toBeInTheDocument();
  });
});
