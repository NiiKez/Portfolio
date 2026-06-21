import type { MetadataRoute } from 'next';

import { getProjects } from '@/lib/queries/projects';
import { getBaseUrl } from '@/lib/site-url';

// Render per-request instead of prerendering at build. The sitemap reads the
// live projects table, so static generation would (a) pin it to build-time data
// until the next rebuild and (b) force a DB round-trip during `next build`.
// Matching the rest of the force-dynamic site keeps newly published projects in
// the sitemap immediately and removes the build-time data dependency.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const projects = await getProjects();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  const projectRoutes: MetadataRoute.Sitemap = projects.map((project) => ({
    url: `${baseUrl}/projects/${project.id}`,
    lastModified: new Date(project.updated_at),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...projectRoutes];
}
