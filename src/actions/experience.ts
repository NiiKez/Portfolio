'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { assertReorderIdsExist, distinctReorderIds } from '@/lib/reorder';
import { safeAction } from '@/lib/safe-action';
import { createClient } from '@/lib/supabase/server';
import {
  experienceSchema,
  reorderSchema,
  type ExperienceInput,
  type ReorderInput,
} from '@/lib/validations';
import type { Experience } from '@/types';

function revalidateExperienceSurfaces() {
  revalidatePath('/about');
  revalidatePath('/admin/experience');
}

const updateExperienceSchema = experienceSchema.extend({
  id: z.uuid(),
});

type UpdateExperienceInput = z.infer<typeof updateExperienceSchema>;

const deleteExperienceSchema = z.object({ id: z.uuid() });
type DeleteExperienceInput = z.infer<typeof deleteExperienceSchema>;

export const createExperience = safeAction<ExperienceInput, Experience>({
  name: 'experience.create',
  schema: experienceSchema,
  handler: async (input) => {
    const supabase = await createClient();

    const { data: max } = await supabase
      .from('experiences')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (max?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('experiences')
      .insert({ ...input, sort_order: nextOrder })
      .select()
      .single();

    if (error) throw error;

    revalidateExperienceSurfaces();
    return data as Experience;
  },
});

export const updateExperience = safeAction<UpdateExperienceInput, Experience>({
  name: 'experience.update',
  schema: updateExperienceSchema,
  handler: async ({ id, ...fields }) => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('experiences')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    // A 0-row update makes `.single()` return PGRST116 above, but guard `data`
    // explicitly so we never return `{ success: true, data: null }` if that
    // contract ever changes (e.g. a switch to `.maybeSingle()`).
    if (!data) throw new Error('Experience not found');

    revalidateExperienceSurfaces();
    return data as Experience;
  },
});

export const deleteExperience = safeAction<
  DeleteExperienceInput,
  { id: string }
>({
  name: 'experience.delete',
  schema: deleteExperienceSchema,
  handler: async ({ id }) => {
    const supabase = await createClient();

    const { error } = await supabase.from('experiences').delete().eq('id', id);
    if (error) throw error;

    revalidateExperienceSurfaces();
    return { id };
  },
});

export const reorderExperiences = safeAction<ReorderInput, { count: number }>({
  name: 'experience.reorder',
  schema: reorderSchema,
  handler: async (items) => {
    const supabase = await createClient();
    const ids = distinctReorderIds(items);

    // Verify every id exists before the wholesale UPDATE; an unknown id (a
    // stale/replayed payload) would otherwise be silently ignored yet still
    // reported as a success.
    const { data: rows, error: fetchError } = await supabase
      .from('experiences')
      .select('id')
      .in('id', ids);
    if (fetchError) throw fetchError;
    assertReorderIdsExist(
      ids,
      (rows ?? []).map((row) => row.id),
    );

    // Single atomic statement instead of one UPDATE per row.
    const { error } = await supabase.rpc('reorder_experiences', { items });
    if (error) throw error;

    revalidateExperienceSurfaces();
    return { count: ids.length };
  },
});
