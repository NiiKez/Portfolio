import { getProjects } from '@/lib/queries/projects';
import { ProjectGrid } from '@/components/projects/project-grid';
import { PageHeader } from '@/components/ui/page-header';

export const metadata = {
  title: 'Projects',
  description: 'A showcase of the projects I have built.',
};

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <PageHeader
        title="Projects"
        description="A collection of things I've built."
        className="mb-10"
      />
      <ProjectGrid projects={projects} />
    </div>
  );
}
