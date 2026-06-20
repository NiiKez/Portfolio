'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { assertReorderIdsExist, distinctReorderIds } from '@/lib/reorder';
import { safeAction } from '@/lib/safe-action';
import { createClient } from '@/lib/supabase/server';
import {
  reorderSchema,
  skillSchema,
  type ReorderInput,
  type SkillInput,
} from '@/lib/validations';
import type { Skill } from '@/types';

function revalidateSkillSurfaces() {
  revalidatePath('/');
  revalidatePath('/about');
  revalidatePath('/admin/skills');
}

const updateSkillSchema = skillSchema.extend({
  id: z.uuid(),
});

type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

const deleteSkillSchema = z.object({ id: z.uuid() });
type DeleteSkillInput = z.infer<typeof deleteSkillSchema>;

export const createSkill = safeAction<SkillInput, Skill>({
  name: 'skills.create',
  schema: skillSchema,
  handler: async (input) => {
    const supabase = await createClient();

    const { data: max } = await supabase
      .from('skills')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (max?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('skills')
      .insert({ ...input, sort_order: nextOrder })
      .select()
      .single();

    if (error) throw error;

    revalidateSkillSurfaces();
    return data as Skill;
  },
});

export const updateSkill = safeAction<UpdateSkillInput, Skill>({
  name: 'skills.update',
  schema: updateSkillSchema,
  handler: async ({ id, ...fields }) => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('skills')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    // A 0-row update makes `.single()` return PGRST116 above, but guard `data`
    // explicitly so we never return `{ success: true, data: null }` if that
    // contract ever changes (e.g. a switch to `.maybeSingle()`).
    if (!data) throw new Error('Skill not found');

    revalidateSkillSurfaces();
    return data as Skill;
  },
});

export const deleteSkill = safeAction<DeleteSkillInput, { id: string }>({
  name: 'skills.delete',
  schema: deleteSkillSchema,
  handler: async ({ id }) => {
    const supabase = await createClient();

    const { error } = await supabase.from('skills').delete().eq('id', id);
    if (error) throw error;

    revalidateSkillSurfaces();
    return { id };
  },
});

export const reorderSkills = safeAction<ReorderInput, { count: number }>({
  name: 'skills.reorder',
  schema: reorderSchema,
  handler: async (items) => {
    const supabase = await createClient();
    const ids = distinctReorderIds(items);

    // Verify every id exists before the wholesale UPDATE; an unknown id (a
    // stale/replayed payload) would otherwise be silently ignored yet still
    // reported as a success.
    const { data: rows, error: fetchError } = await supabase
      .from('skills')
      .select('id')
      .in('id', ids);
    if (fetchError) throw fetchError;
    assertReorderIdsExist(
      ids,
      (rows ?? []).map((row) => row.id),
    );

    // Single atomic statement instead of one UPDATE per row.
    const { error } = await supabase.rpc('reorder_skills', { items });
    if (error) throw error;

    revalidateSkillSurfaces();
    return { count: ids.length };
  },
});
