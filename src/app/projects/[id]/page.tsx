import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Globe } from 'lucide-react';
import { z } from 'zod';

import { GitHubIcon } from '@/components/icons/social-icons';
import { MarkdownContent } from '@/components/projects/markdown-content';
import { ProjectGallery } from '@/components/projects/project-gallery';
import { ProjectVideo } from '@/components/projects/project-video';
import { markdownToPlainText } from '@/lib/markdown';
import { getProjectById } from '@/lib/queries/projects';

// Rendering is dynamic (per-request) so the CSP nonce in the page HTML matches
// the per-request CSP header — see `export const dynamic` in the root layout.
// Static generation / ISR (`generateStaticParams` + `revalidate`) was removed
// for this reason; a cached page would embed a stale, blocked nonce.

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return {};
  const project = await getProjectById(id);
  if (!project) return {};
  return {
    title: project.title,
    // Strip Markdown so search/social snippets don't show raw `**`/`#`/`](…)`
    // syntax or get cut mid-token.
    description: markdownToPlainText(project.description).slice(0, 160),
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const project = await getProjectById(id);

  if (!project) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-4">
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
          }}
        >
          {project.title}
        </h1>
        {project.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.technologies.map((tech) => (
              <span
                key={tech.id}
                className="rounded-md bg-accent px-2 py-0.5 text-accent-foreground"
                style={{ fontSize: '0.7rem', fontWeight: 500 }}
              >
                {tech.name}
              </span>
            ))}
          </div>
        )}
      </header>

      {project.demo_video_path && (
        <ProjectVideo
          videoPath={project.demo_video_path}
          posterPath={project.demo_video_poster_path}
          projectTitle={project.title}
        />
      )}

      {project.screenshots.length > 0 ? (
        <ProjectGallery
          screenshots={project.screenshots}
          projectTitle={project.title}
        />
      ) : (
        !project.demo_video_path && (
          <div className="aspect-video w-full rounded-lg bg-muted" />
        )
      )}

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <MarkdownContent content={project.description} />
      </div>

      {(project.live_url || project.github_url) && (
        <div className="flex flex-wrap gap-3">
          {project.live_url && (
            <Link
              href={project.live_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Globe className="size-4" />
              Visit live site
            </Link>
          )}
          {project.github_url && (
            <Link
              href={project.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GitHubIcon className="size-4" />
              View on GitHub
            </Link>
          )}
        </div>
      )}

      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
      </div>
    </div>
  );
}
