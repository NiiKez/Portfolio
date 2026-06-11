import Image from 'next/image';
import Link from 'next/link';
import { PlayIcon } from 'lucide-react';

import type { ProjectWithDetails } from '@/types';

type ProjectCardProps = {
  project: ProjectWithDetails;
};

function screenshotUrl(storagePath: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const truncated =
    project.description.length > 160
      ? project.description.slice(0, 157) + '…'
      : project.description;

  const firstScreenshot = project.screenshots[0] ?? null;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-md bg-muted">
        {firstScreenshot && (
          <Image
            src={screenshotUrl(firstScreenshot.storage_path)}
            alt={firstScreenshot.alt_text ?? project.title}
            fill
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        )}
        {project.demo_video_path && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            <PlayIcon className="size-3 fill-current" />
            Demo
          </span>
        )}
      </div>

      <h2 className="font-semibold leading-tight group-hover:text-primary">
        {project.title}
      </h2>

      <p className="mt-2 flex-1 text-sm text-muted-foreground">{truncated}</p>

      {project.technologies.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {project.technologies.map((tech) => (
            <span
              key={tech.id}
              className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
            >
              {tech.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
