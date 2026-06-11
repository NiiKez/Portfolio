'use client';

import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

import { profile } from '@/lib/profile';
import type { Experience, Skill } from '@/types';

type AboutContentProps = {
  skills: Skill[];
  experiences: Experience[];
};

const EASE = [0.16, 1, 0.3, 1] as const;

// Treat copy that still starts with "TODO" as not-yet-filled so the page
// degrades to clean-but-empty instead of showing placeholder text to visitors.
const isPlaceholder = (value: string) => value.trimStart().startsWith('TODO');

export function AboutContent({ skills, experiences }: AboutContentProps) {
  const shouldReduce = useReducedMotion();

  const fadeUp = (delay = 0) =>
    shouldReduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: EASE, delay },
        };

  const showIntro = !isPlaceholder(profile.about);

  // Group skills by category, preserving the admin sort order.
  const categories: { name: string; items: Skill[] }[] = [];
  for (const skill of skills) {
    let group = categories.find((c) => c.name === skill.category);
    if (!group) {
      group = { name: skill.category, items: [] };
      categories.push(group);
    }
    group.items.push(skill);
  }

  return (
    <>
      {/* Intro narrative */}
      {showIntro && (
        <motion.section className="max-w-2xl pb-16" {...fadeUp(0)}>
          <p className="text-muted-foreground" style={{ lineHeight: 1.8 }}>
            {profile.about}
          </p>
        </motion.section>
      )}

      {/* Experience */}
      {experiences.length > 0 && (
        <section className="border-t border-border py-16">
          <motion.h2 className="mb-10" {...fadeUp(0)}>
            Experience
          </motion.h2>
          <ol className="flex flex-col gap-4">
            {experiences.map((item, i) => {
              const techs = item.technologies ?? [];
              // Each blank-line-separated block becomes a bullet; soft-wrapped
              // lines within a block are joined so pasted hard wraps don't
              // shred one achievement into many bullets. A single block is
              // shown as a paragraph.
              const points = item.description
                .split(/\n\s*\n/)
                .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
                .filter(Boolean);
              return (
                <motion.li key={item.id} {...fadeUp(0.05 * i)}>
                  <article className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/25">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                        {item.role}
                      </h3>
                      <span
                        className="text-muted-foreground"
                        style={{ fontSize: '0.8rem' }}
                      >
                        {item.period}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {item.company_url ? (
                        <a
                          href={item.company_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-sm text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ fontSize: '0.9rem', fontWeight: 500 }}
                        >
                          {item.company}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span
                          className="text-foreground"
                          style={{ fontSize: '0.9rem', fontWeight: 500 }}
                        >
                          {item.company}
                        </span>
                      )}
                      <span
                        className="rounded-full bg-secondary px-2.5 py-0.5 uppercase text-secondary-foreground"
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                        }}
                      >
                        {item.kind}
                      </span>
                      {item.location && (
                        <span
                          className="text-muted-foreground"
                          style={{ fontSize: '0.8rem' }}
                        >
                          {item.location}
                        </span>
                      )}
                    </div>

                    {points.length > 1 ? (
                      <ul
                        className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground"
                        style={{ fontSize: '0.9rem', lineHeight: 1.7 }}
                      >
                        {points.map((point, pi) => (
                          <li key={pi}>{point}</li>
                        ))}
                      </ul>
                    ) : (
                      <p
                        className="mt-3 text-muted-foreground"
                        style={{ fontSize: '0.9rem', lineHeight: 1.7 }}
                      >
                        {points[0]}
                      </p>
                    )}

                    {techs.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {techs.map((tech) => (
                          <span
                            key={tech}
                            className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                </motion.li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Tech stack */}
      {categories.length > 0 && (
        <section className="border-t border-border py-16">
          <motion.h2 className="mb-3" {...fadeUp(0)}>
            Technologies I work with
          </motion.h2>
          <motion.p
            className="mb-10 max-w-2xl text-muted-foreground"
            style={{ fontSize: '0.9rem', lineHeight: 1.7 }}
            {...fadeUp(0.05)}
          >
            The tools and languages I reach for across the stack, grouped by
            area.
          </motion.p>

          <div className="flex flex-col gap-8">
            {categories.map((group, gi) => (
              <motion.div key={group.name} {...fadeUp(0.05 * gi)}>
                <p
                  className="mb-3 uppercase text-muted-foreground"
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                  }}
                >
                  {group.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((skill) => (
                    <span
                      key={skill.id}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-foreground transition-colors hover:border-primary/35 hover:bg-accent"
                      style={{ fontSize: '0.875rem' }}
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
