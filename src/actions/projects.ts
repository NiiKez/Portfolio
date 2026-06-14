'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { safeAction } from '@/lib/safe-action';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  projectSchema,
  reorderSchema,
  type ProjectInput,
  type ReorderInput,
} from '@/lib/validations';
import type { Project } from '@/types';

function revalidateProjectSurfaces(id?: string) {
  revalidatePath('/projects');
  revalidatePath('/');
  revalidatePath('/admin/projects');
  if (id) {
    revalidatePath(`/projects/${id}`);
    revalidatePath(`/admin/projects/${id}`);
  }
}

const updateProjectSchema = projectSchema.extend({
  id: z.uuid(),
});

type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

const deleteProjectSchema = z.object({ id: z.uuid() });
type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;

export const createProject = safeAction<ProjectInput, Project>({
  name: 'projects.create',
  schema: projectSchema,
  handler: async (input) => {
    const supabase = await createClient();

    const { technology_ids, ...fields } = input;

    const { data: max } = await supabase
      .from('projects')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (max?.sort_order ?? -1) + 1;

    const { data: project, error } = await supabase
      .from('projects')
      .insert({ ...fields, sort_order: nextOrder })
      .select()
      .single();

    if (error) throw error;

    if (technology_ids.length > 0) {
      const rows = technology_ids.map((skill_id) => ({
        project_id: project.id,
        skill_id,
      }));
      const { error: linkError } = await supabase
        .from('project_technologies')
        .insert(rows);
      if (linkError) {
        // Compensate: remove the just-created project so it is not orphaned
        // without its technology links.
        const { error: cleanupError } = await supabase
          .from('projects')
          .delete()
          .eq('id', project.id);
        if (cleanupError) {
          // The compensation itself failed — surface the orphaned row so it is
          // observable rather than silently lost.
          logger.error('projects.create: compensation delete failed', {
            action: 'projects.create',
            projectId: project.id,
            error: cleanupError.message,
          });
        }
        throw linkError;
      }
    }

    revalidateProjectSurfaces(project.id);
    return project as Project;
  },
});

export const updateProject = safeAction<UpdateProjectInput, Project>({
  name: 'projects.update',
  schema: updateProjectSchema,
  handler: async ({ id, technology_ids, ...fields }) => {
    const supabase = await createClient();

    // Single atomic RPC: updates the row and replaces its technology links in
    // one transaction. Raises if the project doesn't exist, and rolls the whole
    // thing back on any failure (e.g. a bad skill_id FK) — so there's no
    // partially-applied state and no compensation logic to get wrong.
    const { data: project, error } = await supabase.rpc(
      'update_project_with_techs',
      {
        p_id: id,
        p_title: fields.title,
        p_description: fields.description,
        p_github_url: fields.github_url,
        p_live_url: fields.live_url,
        p_technology_ids: technology_ids,
      },
    );

    if (error) throw error;

    revalidateProjectSurfaces(id);
    return project as Project;
  },
});

export const deleteProject = safeAction<DeleteProjectInput, { id: string }>({
  name: 'projects.delete',
  schema: deleteProjectSchema,
  handler: async ({ id }) => {
    const supabase = await createClient();

    const { data: screenshots, error: fetchError } = await supabase
      .from('project_screenshots')
      .select('storage_path')
      .eq('project_id', id);
    if (fetchError) throw fetchError;

    const paths = (screenshots ?? [])
      .map((s) => s.storage_path)
      .filter(Boolean);

    // Grab the demo video + poster paths (if any) before the row is gone so the
    // files can be cleaned up alongside the screenshots.
    const { data: projectRow } = await supabase
      .from('projects')
      .select('demo_video_path, demo_video_poster_path')
      .eq('id', id)
      .maybeSingle();
    const videoPath = projectRow?.demo_video_path;
    const posterPath = projectRow?.demo_video_poster_path;

    // Delete the parent row. The child tables (project_technologies,
    // project_screenshots) are removed automatically by their ON DELETE CASCADE
    // FKs, so this single delete is atomic. An orphaned storage file is far less
    // harmful than a row pointing at files we may fail to delete, so storage
    // cleanup follows.
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    if (paths.length > 0) {
      // Best-effort: a storage failure must not fail the action.
      await supabase.storage
        .from('screenshots')
        .remove(paths)
        .catch(() => undefined);
    }

    // The poster lives in the screenshots bucket (not project_screenshots).
    if (posterPath) {
      await supabase.storage
        .from('screenshots')
        .remove([posterPath])
        .catch(() => undefined);
    }

    if (videoPath) {
      // Best-effort: a storage failure must not fail the action. The `videos`
      // bucket is deleted through the service-role client — mirroring
      // `removeProjectVideo` in actions/videos.ts — so the cleanup does not
      // depend on the authenticated client passing the bucket's RLS, which
      // would otherwise risk silently orphaning the object.
      await createAdminClient()
        .storage.from('videos')
        .remove([videoPath])
        .catch(() => undefined);
    }

    revalidateProjectSurfaces(id);
    return { id };
  },
});

export const reorderProjects = safeAction<ReorderInput, { count: number }>({
  name: 'projects.reorder',
  schema: reorderSchema,
  handler: async (items) => {
    const supabase = await createClient();

    // Single atomic statement instead of one UPDATE per row.
    const { error } = await supabase.rpc('reorder_projects', { items });
    if (error) throw error;

    revalidateProjectSurfaces();
    return { count: items.length };
  },
});
