'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Mail } from 'lucide-react';

import { GitHubIcon, LinkedInIcon } from '@/components/icons/social-icons';
import { hasContactEmail, profile } from '@/lib/profile';

export function HomeHero() {
  const shouldReduce = useReducedMotion();

  const fadeUp = (delay = 0) =>
    shouldReduce
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.55,
            delay,
            ease: [0.16, 1, 0.3, 1] as const,
          },
        };

  return (
    <section
      className="flex min-h-[82vh] flex-col justify-center py-24 md:py-36"
      aria-label="Introduction"
    >
      <motion.div {...fadeUp(0)}>
        <p
          className="mb-6 uppercase text-primary"
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.18em',
          }}
        >
          Available for work
        </p>
      </motion.div>

      <motion.div {...fadeUp(0.08)}>
        <h1
          className="mb-4"
          style={{
            fontSize: 'clamp(2.8rem, 9vw, 6rem)',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.035em',
          }}
        >
          {profile.name}
        </h1>
        <p
          className="mb-6 max-w-lg text-muted-foreground"
          style={{ fontSize: 'clamp(1.15rem, 3vw, 1.6rem)', lineHeight: 1.4 }}
        >
          {profile.title}
        </p>
      </motion.div>

      <motion.div {...fadeUp(0.16)}>
        <p
          className="mb-10 max-w-md text-muted-foreground"
          style={{ lineHeight: 1.7 }}
        >
          {profile.bio}
        </p>
      </motion.div>

      <motion.div {...fadeUp(0.22)} className="mb-12 flex flex-wrap gap-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-primary-foreground transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontSize: '0.9rem', fontWeight: 500 }}
        >
          View Projects <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/about"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontSize: '0.9rem' }}
        >
          Get in Touch
        </Link>
      </motion.div>

      <motion.div
        {...fadeUp(0.28)}
        className="flex items-center gap-5 text-muted-foreground"
      >
        <a
          href={profile.github}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <GitHubIcon className="h-5 w-5" />
        </a>
        <a
          href={profile.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn"
          className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <LinkedInIcon className="h-5 w-5" />
        </a>
        {hasContactEmail() && (
          <a
            href={`mailto:${profile.email}`}
            aria-label="Email"
            className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <Mail className="h-5 w-5" />
          </a>
        )}
      </motion.div>
    </section>
  );
}
