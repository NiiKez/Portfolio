import type { Metadata } from 'next';

import { DailyDrivers } from '@/components/home/daily-drivers';
import { FeaturedProjects } from '@/components/home/featured-projects';
import { HomeHero } from '@/components/home/home-hero';
import { getProjects } from '@/lib/queries/projects';
import { getSkills } from '@/lib/queries/skills';

export const metadata: Metadata = {
  title: 'Home',
  description:
    'A personal portfolio showcasing my skills, projects, and professional experience.',
};

export const revalidate = 3600;

export default async function HomePage() {
  const [skills, projects] = await Promise.all([getSkills(), getProjects()]);

  const dailyDrivers = skills
    .filter((s) => s.proficiency === 'advanced')
    .slice(0, 8);
  const featured = projects.slice(0, 2);

  return (
    <div className="mx-auto w-full max-w-5xl px-6">
      <HomeHero />
      <FeaturedProjects projects={featured} />
      <DailyDrivers skills={dailyDrivers} />
    </div>
  );
}
