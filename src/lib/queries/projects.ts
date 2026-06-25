import 'server-only';

import { cache } from 'react';
import type { QueryData, SupabaseClient } from '@supabase/supabase-js';

import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { ProjectWithDetails, Skill } from '@/types';

const PROJECT_SELECT = `
  *,
  screenshots:project_screenshots(*),
  project_technologies(skills(*))
` as const;

// Derive the row shape straight from the schema-typed query, so it stays in
// sync with the DB types automatically instead of a hand-written cast. Typed
// against the shared SupabaseClient so it works for both the public (anon) and
// authenticated (admin) clients.
const projectDetailQuery = (client: SupabaseClient<Database, 'portfolio'>) =>
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
    is_published: row.is_published,
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
    // Public surface: published only. RLS (`public_read`) already enforces this
    // on the anon key; the explicit filter is defence-in-depth and keeps the
    // intent visible at the call site.
    .eq('is_published', true)
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
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapRow);
  },
);

/**
 * Lightweight existence check for the analytics ingest: is there a PUBLISHED
 * project with this id? Used to drop scanner probes at fake / deleted / draft
 * ids (e.g. the all-zeros UUID) before they count as a `/projects/{id}` view —
 * without loading the full project (screenshots + technologies) just to count
 * one. Runs on the anon `public_read` path, so it sees exactly what a visitor
 * could: a draft or unknown id reads as nonexistent. Not request-`cache()`d —
 * the ingest checks one id per request.
 */
export async function isPublishedProject(id: string): Promise<boolean> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', id)
    // Defence-in-depth: RLS `public_read` already restricts the anon key to
    // published rows; the explicit filter keeps the intent visible here too.
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export const getProjectById = cache(
  async (id: string): Promise<ProjectWithDetails | null> => {
    const supabase = createPublicClient();

    const { data, error } = await projectDetailQuery(supabase)
      .eq('id', id)
      // A draft must 404 on its direct public URL too, not just the listing.
      .eq('is_published', true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapRow(data);
  },
);

// ---------------------------------------------------------------------------
// Admin-only variants — read EVERY project (drafts included) via the
// authenticated server client. The admin sees drafts through the `admin_write`
// RLS policy (FOR ALL / is_admin()), which Postgres OR-combines with the
// published-only `public_read` policy; these deliberately carry NO
// `is_published` filter. Never use them on a public surface.

export const getProjectsForAdmin = cache(
  async (): Promise<ProjectWithDetails[]> => {
    const supabase = await createClient();

    const { data, error } = await projectDetailQuery(supabase)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapRow);
  },
);

export const getProjectByIdForAdmin = cache(
  async (id: string): Promise<ProjectWithDetails | null> => {
    const supabase = await createClient();

    const { data, error } = await projectDetailQuery(supabase)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapRow(data);
  },
);
