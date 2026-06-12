'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, ExternalLink, Globe } from 'lucide-react';

import { GitHubIcon } from '@/components/icons/social-icons';
import { clientEnv } from '@/lib/env.client';
import { markdownToPlainText } from '@/lib/markdown';
import type { ProjectWithDetails } from '@/types';

type ProjectGridProps = {
  projects: ProjectWithDetails[];
};

const GRADIENT_FALLBACKS = [
  'linear-gradient(135deg, oklch(0.2 0.05 48), oklch(0.14 0.02 200))',
  'linear-gradient(135deg, oklch(0.18 0.04 200), oklch(0.14 0.03 260))',
  'linear-gradient(135deg, oklch(0.2 0.05 260), oklch(0.14 0.02 48))',
];

function screenshotUrl(storagePath: string) {
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  const shouldReduce = useReducedMotion();
  const [activeTech, setActiveTech] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const allTechNames = Array.from(
    new Set(projects.flatMap((p) => p.technologies.map((t) => t.name))),
  ).sort();

  const filtered =
    activeTech === null
      ? projects
      : projects.filter((p) =>
          p.technologies.some((t) => t.name === activeTech),
        );

  const hoveredProject = filtered.find((p) => p.id === hoveredId) ?? null;
  const hoveredIndex = hoveredProject
    ? filtered.findIndex((p) => p.id === hoveredProject.id)
    : -1;

  return (
    <div>
      {/* Filter pills */}
      {allTechNames.length > 0 && (
        <div
          className="mb-12 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by technology"
        >
          <button
            type="button"
            onClick={() => setActiveTech(null)}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              activeTech === null
                ? 'bg-primary text-primary-foreground'
                : 'bg-accent text-accent-foreground hover:bg-accent/70'
            }`}
            style={{ fontSize: '0.8rem', fontWeight: 500 }}
            aria-pressed={activeTech === null}
          >
            All
          </button>
          {allTechNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveTech(name === activeTech ? null : name)}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                activeTech === name
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-accent-foreground hover:bg-accent/70'
              }`}
              style={{ fontSize: '0.8rem', fontWeight: 500 }}
              aria-pressed={activeTech === name}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">
          No projects found.
        </p>
      ) : (
        <div className="items-start lg:grid lg:grid-cols-[1fr_280px] lg:gap-12">
          {/* Project list */}
          <div>
            {filtered.map((project, i) => (
              <motion.div
                key={project.id}
                {...(shouldReduce
                  ? {}
                  : {
                      initial: { opacity: 0 },
                      animate: { opacity: 1 },
                      transition: { delay: i * 0.06, duration: 0.4 },
                    })}
                onMouseEnter={() => setHoveredId(project.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(project.id)}
                onBlur={() => setHoveredId(null)}
                className="group relative cursor-pointer border-t border-border py-8 transition-colors hover:bg-accent/30"
              >
                <div className="flex gap-5">
                  <span
                    className="shrink-0 pt-0.5 text-muted-foreground tabular-nums"
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      width: '1.75rem',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h2
                        className="transition-colors group-hover:text-primary"
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          lineHeight: 1.3,
                        }}
                      >
                        {/* Stretched link: makes the entire row open the
                            project, while the icon links below stay clickable
                            via their own stacking context (relative z-10). */}
                        <Link
                          href={`/projects/${project.id}`}
                          className="rounded-sm before:absolute before:inset-0 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {project.title}
                        </Link>
                      </h2>
                    </div>

                    <p
                      className="mb-4 text-muted-foreground line-clamp-2"
                      style={{ fontSize: '0.9rem', lineHeight: 1.65 }}
                    >
                      {markdownToPlainText(project.description)}
                    </p>

                    <div className="flex items-end justify-between gap-4">
                      {project.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {project.technologies.slice(0, 5).map((tech) => (
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

                      <div className="relative z-10 flex shrink-0 items-center gap-3 text-muted-foreground">
                        {/* Kept as a real link so the icon itself still
                            navigates, but hidden from AT and the tab order
                            because the title's stretched link is the accessible
                            target for this row (avoids a duplicate link). */}
                        <Link
                          href={`/projects/${project.id}`}
                          aria-hidden="true"
                          tabIndex={-1}
                          className="rounded-sm transition-colors hover:text-primary group-hover:text-primary"
                        >
                          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </Link>
                        {project.live_url && (
                          <a
                            href={project.live_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${project.title} live site`}
                            className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                          >
                            <Globe className="h-4 w-4" />
                          </a>
                        )}
                        {project.github_url && (
                          <a
                            href={project.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${project.title} on GitHub`}
                            className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                          >
                            <GitHubIcon className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Sticky preview aside (desktop only) */}
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <AnimatePresence mode="wait">
                {hoveredProject ? (
                  <motion.div
                    key={hoveredProject.id}
                    initial={shouldReduce ? {} : { opacity: 0, scale: 0.97 }}
                    animate={shouldReduce ? {} : { opacity: 1, scale: 1 }}
                    exit={shouldReduce ? {} : { opacity: 0, scale: 0.97 }}
                    transition={{
                      duration: 0.22,
                      ease: [0.16, 1, 0.3, 1] as const,
                    }}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <div className="relative aspect-[4/3] w-full bg-muted">
                      {hoveredProject.screenshots[0] ? (
                        <Image
                          src={screenshotUrl(
                            hoveredProject.screenshots[0].storage_path,
                          )}
                          alt={
                            hoveredProject.screenshots[0].alt_text ??
                            hoveredProject.title
                          }
                          fill
                          sizes="280px"
                          className="object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background:
                              GRADIENT_FALLBACKS[
                                hoveredIndex % GRADIENT_FALLBACKS.length
                              ],
                          }}
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <p style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                        {hoveredProject.title}
                      </p>
                      <div
                        className="mt-2 flex items-center gap-3"
                        style={{ fontSize: '0.72rem' }}
                      >
                        <Link
                          href={`/projects/${hoveredProject.id}`}
                          className="flex items-center gap-1 text-primary transition-opacity hover:opacity-80"
                        >
                          <ExternalLink className="h-3 w-3" /> Details
                        </Link>
                        {hoveredProject.live_url && (
                          <a
                            href={hoveredProject.live_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Globe className="h-3 w-3" /> Live
                          </a>
                        )}
                        {hoveredProject.github_url && (
                          <a
                            href={hoveredProject.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <GitHubIcon className="h-3 w-3" /> Code
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={shouldReduce ? {} : { opacity: 0 }}
                    animate={shouldReduce ? {} : { opacity: 1 }}
                    exit={shouldReduce ? {} : { opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border"
                  >
                    <ExternalLink className="h-6 w-6 text-muted-foreground/30" />
                    <p
                      className="text-muted-foreground/70"
                      style={{ fontSize: '0.75rem' }}
                    >
                      Hover a project
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
