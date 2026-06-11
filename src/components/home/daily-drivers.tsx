'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

import type { Skill } from '@/types';

type DailyDriversProps = {
  skills: Skill[];
};

export function DailyDrivers({ skills }: DailyDriversProps) {
  const shouldReduce = useReducedMotion();
  if (skills.length === 0) return null;

  return (
    <section
      className="border-t border-border py-16"
      aria-label="Skills preview"
    >
      <div className="mb-10 flex items-center justify-between">
        <h2>Daily Drivers</h2>
        <Link
          href="/about"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          style={{ fontSize: '0.875rem' }}
        >
          Full stack <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {skills.map((s, i) => (
          <motion.span
            key={s.id}
            {...(shouldReduce
              ? {}
              : {
                  initial: { opacity: 0, scale: 0.92 },
                  animate: { opacity: 1, scale: 1 },
                  transition: { delay: 0.05 * i, duration: 0.3 },
                })}
            className="rounded-lg border border-border bg-card px-4 py-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            style={{ fontSize: '0.875rem' }}
          >
            {s.name}
          </motion.span>
        ))}
      </div>
    </section>
  );
}
