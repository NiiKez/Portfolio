import 'server-only';

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
    .filter((s): s is Skill => s !== null);

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

export async function getProjects(): Promise<ProjectWithDetails[]> {
  const supabase = createPublicClient();

  const { data, error } = await projectDetailQuery(supabase)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getProjectById(
  id: string,
): Promise<ProjectWithDetails | null> {
  const supabase = createPublicClient();

  const { data, error } = await projectDetailQuery(supabase)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRow(data);
}
