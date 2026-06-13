import 'server-only';

import { cache } from 'react';

import { createPublicClient } from '@/lib/supabase/public';
import type { Skill } from '@/types';

// Request-scoped memoization — see the note in `queries/projects.ts`.
export const getSkills = cache(async (): Promise<Skill[]> => {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Skill[];
});
