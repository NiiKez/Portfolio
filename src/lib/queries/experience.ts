import 'server-only';

import { createPublicClient } from '@/lib/supabase/public';
import type { Experience } from '@/types';

export async function getExperiences(): Promise<Experience[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from('experiences')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Experience[];
}
