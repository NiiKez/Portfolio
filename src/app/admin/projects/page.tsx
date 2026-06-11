import { ProjectList } from '@/components/admin/project-list';
import { getProjects } from '@/lib/queries/projects';

export const metadata = {
  title: 'Projects · Admin',
};

export default async function AdminProjectsPage() {
  const projects = await getProjects();

  return <ProjectList initialProjects={projects} />;
}
