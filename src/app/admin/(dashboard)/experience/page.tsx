import { getExperiences } from '@/lib/queries/experience';
import { ExperienceList } from '@/components/admin/experience-list';

export const metadata = {
  title: 'Experience · Admin',
};

export default async function AdminExperiencePage() {
  const experiences = await getExperiences();

  return <ExperienceList initialExperiences={experiences} />;
}
