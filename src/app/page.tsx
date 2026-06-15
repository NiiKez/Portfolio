import type { Metadata } from 'next';

import { DailyDrivers } from '@/components/home/daily-drivers';
import { FeaturedProjects } from '@/components/home/featured-projects';
import { HomeHero } from '@/components/home/home-hero';
import { getFeaturedProjects } from '@/lib/queries/projects';
import { getSkills } from '@/lib/queries/skills';

export const metadata: Metadata = {
  title: 'Home',
  description:
    'A personal portfolio showcasing my skills, projects, and professional experience.',
};

export default async function HomePage() {
  const [skills, featured] = await Promise.all([
    getSkills(),
    getFeaturedProjects(2),
  ]);

  const dailyDrivers = skills
    .filter((s) => s.proficiency === 'advanced')
    .slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-5xl px-6">
      <HomeHero />
      <FeaturedProjects projects={featured} />
      <DailyDrivers skills={dailyDrivers} />
    </div>
  );
}
