import 'server-only';

import { cache } from 'react';
import type { QueryData } from '@supabase/supabase-js';

import { createPublicClient } from '@/lib/supabase/public';
import type { ProjectWithDetails, Skill } from '@/types';

const PROJECT_SELECT = `
  *,
  screenshots:project_screenshots(*),
  project_technologies(skills(*))
` as const;

// Derive the row shape straight from the schema-typed query, so it stays in
// sync with the DB types automatically instead of a hand-written cast.
const projectDetailQuery = (client: ReturnType<typeof createPublicClient>) =>
  client.from('projects').select(PROJECT_SELECT);

type ProjectRow = QueryData<ReturnType<typeof projectDetailQuery>>[number];

function mapRow(row: ProjectRow): ProjectWithDetails {
  const screenshots = (row.screenshots ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const technologies = (row.project_technologies ?? [])
    .map((pt) => pt.skills)
    .filter((s): s is Skill => s !== null)
    // PostgREST does not guarantee order for an embedded relation without an
    // explicit order, so sort here (mirroring the screenshots handling above)
    // to keep tech tags stable across requests and avoid hydration flicker.
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    github_url: row.github_url,
    live_url: row.live_url,
    demo_video_path: row.demo_video_path,
    demo_video_poster_path: row.demo_video_poster_path,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    screenshots,
    technologies,
  };
}

// Wrapped in React's request-scoped `cache()` so repeat calls within a single
// request are deduped to one DB round-trip — e.g. a route's `generateMetadata`
// and its page component both load the same project. This memoizes only within
// a request, so it stays compatible with the per-request nonce CSP / force-dynamic
// model (it does NOT cache across requests like ISR would).
export const getProjects = cache(async (): Promise<ProjectWithDetails[]> => {
  const supabase = createPublicClient();

  const { data, error } = await projectDetailQuery(supabase)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
});

// Bounded variant for the home page, which renders only a couple of cards.
// `getProjects()` fetches the ENTIRE projects table (plus every screenshot and
// technology) — fine for the `/projects` listing, but the home page would scan
// the whole table only to discard everything past the first `limit`. This caps
// the scan server-side. Shares the request-scoped `cache()` (keyed on `limit`),
// so distinct calls don't collide with the unbounded `getProjects()`.
export const getFeaturedProjects = cache(
  async (limit = 2): Promise<ProjectWithDetails[]> => {
    const supabase = createPublicClient();

    const { data, error } = await projectDetailQuery(supabase)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapRow);
  },
);

export const getProjectById = cache(
  async (id: string): Promise<ProjectWithDetails | null> => {
    const supabase = createPublicClient();

    const { data, error } = await projectDetailQuery(supabase)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapRow(data);
  },
);
