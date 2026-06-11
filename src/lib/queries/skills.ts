import 'server-only';

import { createPublicClient } from '@/lib/supabase/public';
import type { Skill } from '@/types';

export async function getSkills(): Promise<Skill[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Skill[];
}
