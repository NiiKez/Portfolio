import { ProjectList } from '@/components/admin/project-list';
import { getProjectsForAdmin } from '@/lib/queries/projects';

export const metadata = {
  title: 'Projects · Admin',
};

export default async function AdminProjectsPage() {
  // Admin variant: includes drafts (unpublished projects), unlike the public
  // `/projects` listing.
  const projects = await getProjectsForAdmin();

  return <ProjectList initialProjects={projects} />;
}
