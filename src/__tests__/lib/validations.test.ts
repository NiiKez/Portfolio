import { describe, expect, it } from 'vitest';

import {
  experienceSchema,
  projectSchema,
  reorderSchema,
  screenshotSchema,
  skillSchema,
} from '@/lib/validations';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('skillSchema', () => {
  it('accepts a valid skill', () => {
    const result = skillSchema.safeParse({
      name: 'TypeScript',
      category: 'Languages',
      proficiency: 'advanced',
    });
    expect(result.success).toBe(true);
  });

  it('trims whitespace from name and category', () => {
    const result = skillSchema.parse({
      name: '  Go  ',
      category: '  Languages  ',
      proficiency: 'intermediate',
    });
    expect(result.name).toBe('Go');
    expect(result.category).toBe('Languages');
  });

  it('rejects an empty name', () => {
    const result = skillSchema.safeParse({
      name: '   ',
      category: 'Languages',
      proficiency: 'beginner',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty category', () => {
    const result = skillSchema.safeParse({
      name: 'Go',
      category: '',
      proficiency: 'beginner',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown proficiency', () => {
    const result = skillSchema.safeParse({
      name: 'Go',
      category: 'Languages',
      proficiency: 'expert',
    });
    expect(result.success).toBe(false);
  });

  it('rejects names longer than 100 characters', () => {
    const result = skillSchema.safeParse({
      name: 'a'.repeat(101),
      category: 'Languages',
      proficiency: 'beginner',
    });
    expect(result.success).toBe(false);
  });
});

describe('projectSchema', () => {
  it('accepts a valid project with technologies and a github url', () => {
    const result = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
      github_url: 'https://github.com/me/portfolio',
      technology_ids: [uuid],
    });
    expect(result.github_url).toBe('https://github.com/me/portfolio');
    expect(result.technology_ids).toEqual([uuid]);
  });

  it('defaults technology_ids to an empty array when omitted', () => {
    const result = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
    });
    expect(result.technology_ids).toEqual([]);
  });

  it('transforms an empty github_url to null', () => {
    const result = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
      github_url: '',
    });
    expect(result.github_url).toBeNull();
  });

  it('transforms an omitted github_url to null', () => {
    const result = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
    });
    expect(result.github_url).toBeNull();
  });

  it('transforms a whitespace-only github_url to null', () => {
    const result = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
      github_url: '   ',
    });
    expect(result.github_url).toBeNull();
  });

  it('trims surrounding whitespace from a valid github_url', () => {
    const result = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
      github_url: '  https://github.com/me/portfolio  ',
    });
    expect(result.github_url).toBe('https://github.com/me/portfolio');
  });

  it('rejects a malformed github_url', () => {
    const result = projectSchema.safeParse({
      title: 'Portfolio',
      description: 'My portfolio site',
      github_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a javascript: scheme github_url', () => {
    const result = projectSchema.safeParse({
      title: 'Portfolio',
      description: 'My portfolio site',
      github_url: 'javascript:alert(1)',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a data: scheme github_url', () => {
    const result = projectSchema.safeParse({
      title: 'Portfolio',
      description: 'My portfolio site',
      github_url: 'data:text/html,<script>alert(1)</script>',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-string (numeric) github_url', () => {
    const result = projectSchema.safeParse({
      title: 'Portfolio',
      description: 'My portfolio site',
      github_url: 12345,
    });
    expect(result.success).toBe(false);
  });

  // Dedupe so a duplicate skill id can't violate the
  // project_technologies PK(project_id, skill_id).
  it('dedupes duplicate technology_ids', () => {
    const result = projectSchema.parse({
      title: 'P',
      description: 'd',
      technology_ids: [uuid, uuid],
    });
    expect(result.technology_ids).toEqual([uuid]);
  });

  it('accepts a valid https live_url', () => {
    const result = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
      live_url: 'https://portfolio.example.com',
    });
    expect(result.live_url).toBe('https://portfolio.example.com');
  });

  it('transforms an empty live_url to null', () => {
    const result = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
      live_url: '',
    });
    expect(result.live_url).toBeNull();
  });

  it('transforms an omitted live_url to null', () => {
    const result = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
    });
    expect(result.live_url).toBeNull();
  });

  it('transforms a whitespace-only live_url to null', () => {
    const result = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
      live_url: '  ',
    });
    expect(result.live_url).toBeNull();
  });

  it('rejects a malformed live_url', () => {
    const result = projectSchema.safeParse({
      title: 'Portfolio',
      description: 'My portfolio site',
      live_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-https live_url', () => {
    const result = projectSchema.safeParse({
      title: 'Portfolio',
      description: 'My portfolio site',
      live_url: 'http://insecure.example.com',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a null github_url (the normalized empty value) and keeps it null', () => {
    const result = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
      github_url: null,
      live_url: null,
    });
    expect(result.github_url).toBeNull();
    expect(result.live_url).toBeNull();
  });

  // Regression: the form validates once on the client (turning an empty URL
  // into null) and sends that normalized payload to the server action, which
  // re-validates it. Parsing the schema's own output must succeed, otherwise an
  // empty optional URL fails on save with "github_url: Invalid input".
  it('is idempotent — re-validating its own output succeeds', () => {
    const first = projectSchema.parse({
      title: 'Portfolio',
      description: 'My portfolio site',
      github_url: '',
      live_url: '',
    });
    expect(first.github_url).toBeNull();

    const second = projectSchema.safeParse(first);
    expect(second.success).toBe(true);
    expect(second.data?.github_url).toBeNull();
    expect(second.data?.live_url).toBeNull();
  });

  it('rejects an empty title', () => {
    const result = projectSchema.safeParse({
      title: '   ',
      description: 'My portfolio site',
    });
    expect(result.success).toBe(false);
  });

  it('rejects technology_ids that are not uuids', () => {
    const result = projectSchema.safeParse({
      title: 'Portfolio',
      description: 'My portfolio site',
      technology_ids: ['not-a-uuid'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects descriptions longer than 5000 characters', () => {
    const result = projectSchema.safeParse({
      title: 'Portfolio',
      description: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

describe('experienceSchema', () => {
  const base = {
    role: 'Engineer',
    company: 'Acme',
    period: '2024',
    kind: 'Full-time' as const,
    description: 'Built things',
  };

  it('transforms an empty company_url and location to null', () => {
    const result = experienceSchema.parse({
      ...base,
      company_url: '',
      location: '',
    });
    expect(result.company_url).toBeNull();
    expect(result.location).toBeNull();
  });

  // Regression: same client→server round-trip as projectSchema. The optional
  // company_url and location fields normalize empty input to null, so the
  // schema must accept its own null output when the action re-validates.
  it('is idempotent — re-validating its own output succeeds', () => {
    const first = experienceSchema.parse({
      ...base,
      company_url: '',
      location: '',
    });
    expect(first.company_url).toBeNull();
    expect(first.location).toBeNull();

    const second = experienceSchema.safeParse(first);
    expect(second.success).toBe(true);
    expect(second.data?.company_url).toBeNull();
    expect(second.data?.location).toBeNull();
  });

  it('rejects a non-https company_url', () => {
    const result = experienceSchema.safeParse({
      ...base,
      company_url: 'http://insecure.example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown kind', () => {
    const result = experienceSchema.safeParse({
      ...base,
      kind: 'Contractor',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty role', () => {
    const result = experienceSchema.safeParse({ ...base, role: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty company', () => {
    const result = experienceSchema.safeParse({ ...base, company: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty period', () => {
    const result = experienceSchema.safeParse({ ...base, period: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty description', () => {
    const result = experienceSchema.safeParse({ ...base, description: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a description longer than 5000 characters', () => {
    const result = experienceSchema.safeParse({
      ...base,
      description: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a location longer than 150 characters', () => {
    const result = experienceSchema.safeParse({
      ...base,
      location: 'a'.repeat(151),
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 50 technologies', () => {
    const result = experienceSchema.safeParse({
      ...base,
      technologies: Array.from({ length: 51 }, () => 'tech'),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a technology item longer than 50 characters', () => {
    const result = experienceSchema.safeParse({
      ...base,
      technologies: ['a'.repeat(51)],
    });
    expect(result.success).toBe(false);
  });

  it('yields location null when the location key is omitted', () => {
    const result = experienceSchema.parse(base);
    expect(result.location).toBeNull();
  });

  it('defaults technologies to an empty array when omitted', () => {
    const result = experienceSchema.parse(base);
    expect(result.technologies).toEqual([]);
  });
});

describe('reorderSchema', () => {
  it('accepts a list of valid items', () => {
    const result = reorderSchema.safeParse([
      { id: uuid, sort_order: 0 },
      { id: uuid, sort_order: 5 },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects a negative sort_order', () => {
    const result = reorderSchema.safeParse([{ id: uuid, sort_order: -1 }]);
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer sort_order', () => {
    const result = reorderSchema.safeParse([{ id: uuid, sort_order: 1.5 }]);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid id', () => {
    const result = reorderSchema.safeParse([{ id: 'nope', sort_order: 0 }]);
    expect(result.success).toBe(false);
  });

  it('rejects more than 200 items', () => {
    const items = Array.from({ length: 201 }, (_, index) => ({
      id: uuid,
      sort_order: index,
    }));
    const result = reorderSchema.safeParse(items);
    expect(result.success).toBe(false);
  });

  it('accepts exactly 200 items', () => {
    const items = Array.from({ length: 200 }, () => ({
      id: uuid,
      sort_order: 0,
    }));
    const result = reorderSchema.safeParse(items);
    expect(result.success).toBe(true);
  });

  it('rejects a sort_order above the upper bound', () => {
    const result = reorderSchema.safeParse([{ id: uuid, sort_order: 100001 }]);
    expect(result.success).toBe(false);
  });
});

describe('screenshotSchema', () => {
  it('accepts an optional alt_text', () => {
    expect(screenshotSchema.safeParse({}).success).toBe(true);
    expect(
      screenshotSchema.safeParse({ alt_text: 'A screenshot' }).success,
    ).toBe(true);
  });

  it('rejects alt_text longer than 200 characters', () => {
    const result = screenshotSchema.safeParse({
      alt_text: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});
