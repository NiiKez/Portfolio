import { getSkills } from '@/lib/queries/skills';
import { SkillList } from '@/components/admin/skill-list';

export const metadata = {
  title: 'Skills · Admin',
};

export default async function AdminSkillsPage() {
  const skills = await getSkills();

  return <SkillList initialSkills={skills} />;
}
