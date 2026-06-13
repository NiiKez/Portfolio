import 'server-only';

import { cache } from 'react';

import { createPublicClient } from '@/lib/supabase/public';
import type { Experience } from '@/types';

// Request-scoped memoization — see the note in `queries/projects.ts`.
export const getExperiences = cache(async (): Promise<Experience[]> => {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from('experiences')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Experience[];
});
