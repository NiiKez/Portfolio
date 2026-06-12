'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ExternalLink, Globe, PlayIcon } from 'lucide-react';

import { GitHubIcon } from '@/components/icons/social-icons';
import { SpotlightCard } from '@/components/projects/spotlight-card';
import { clientEnv } from '@/lib/env.client';
import { markdownToPlainText } from '@/lib/markdown';
import type { ProjectWithDetails } from '@/types';

type FeaturedProjectsProps = {
  projects: ProjectWithDetails[];
};

function screenshotUrl(storagePath: string) {
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
}

export function FeaturedProjects({ projects }: FeaturedProjectsProps) {
  const shouldReduce = useReducedMotion();
  if (projects.length === 0) return null;

  return (
    <section
      className="border-t border-border py-16"
      aria-label="Featured projects"
    >
      <div className="mb-10 flex items-center justify-between">
        <h2>Featured Projects</h2>
        <Link
          href="/projects"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          style={{ fontSize: '0.875rem' }}
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p, i) => {
          const firstScreenshot = p.screenshots[0] ?? null;
          return (
            <motion.div
              key={p.id}
              {...(shouldReduce
                ? {}
                : {
                    initial: { opacity: 0, y: 18 },
                    animate: { opacity: 1, y: 0 },
                    transition: {
                      delay: 0.1 + i * 0.1,
                      duration: 0.5,
                      ease: [0.16, 1, 0.3, 1] as const,
                    },
                  })}
            >
              <SpotlightCard className="h-full p-6">
                <div className="relative z-10 flex h-full flex-col">
                  {firstScreenshot && (
                    <div className="relative mb-4 h-36 overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={screenshotUrl(firstScreenshot.storage_path)}
                        alt={firstScreenshot.alt_text ?? p.title}
                        width={640}
                        height={360}
                        className="h-full w-full object-cover opacity-70 transition-opacity duration-500 group-hover:opacity-90"
                      />
                      {p.demo_video_path && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                          <PlayIcon className="size-3 fill-current" />
                          Demo
                        </span>
                      )}
                    </div>
                  )}
                  <h3 className="mb-2">{p.title}</h3>
                  <p
                    className="mb-4 flex-1 text-muted-foreground line-clamp-3"
                    style={{ fontSize: '0.9rem', lineHeight: 1.6 }}
                  >
                    {markdownToPlainText(p.description)}
                  </p>
                  {p.technologies.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {p.technologies.slice(0, 4).map((tech) => (
                        <span
                          key={tech.id}
                          className="rounded-md bg-accent px-2.5 py-1 text-accent-foreground"
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {tech.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-1.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      style={{ fontSize: '0.8rem' }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Details
                    </Link>
                    {p.live_url && (
                      <a
                        href={p.live_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        style={{ fontSize: '0.8rem' }}
                      >
                        <Globe className="h-3.5 w-3.5" /> Live
                      </a>
                    )}
                    {p.github_url && (
                      <a
                        href={p.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        style={{ fontSize: '0.8rem' }}
                      >
                        <GitHubIcon className="h-3.5 w-3.5" /> Code
                      </a>
                    )}
                  </div>
                </div>
              </SpotlightCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
