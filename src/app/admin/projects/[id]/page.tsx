import { notFound } from 'next/navigation';
import { z } from 'zod';

import { ProjectForm } from '@/components/admin/project-form';
import { getProjectById } from '@/lib/queries/projects';
import { getSkills } from '@/lib/queries/skills';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  if (id === 'new') return { title: 'New Project · Admin' };
  return { title: 'Edit Project · Admin' };
}

export default async function AdminProjectEditPage({ params }: Props) {
  const { id } = await params;

  if (id !== 'new' && !z.uuid().safeParse(id).success) notFound();

  const [allSkills, project] = await Promise.all([
    getSkills(),
    id === 'new' ? null : getProjectById(id),
  ]);

  if (id !== 'new' && project === null) notFound();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {project ? 'Edit project' : 'New project'}
        </h1>
        {project && (
          <p className="text-sm text-muted-foreground">{project.title}</p>
        )}
      </header>

      <div className="rounded-lg border border-border bg-card p-6">
        <ProjectForm project={project ?? undefined} allSkills={allSkills} />
      </div>
    </div>
  );
}
