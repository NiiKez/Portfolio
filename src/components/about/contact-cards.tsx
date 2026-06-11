'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Mail, MapPin } from 'lucide-react';

import { CopyEmailButton } from '@/components/about/copy-email-button';
import { GitHubIcon, LinkedInIcon } from '@/components/icons/social-icons';
import { profile } from '@/lib/profile';

type CardData = {
  key: string;
  label: string;
  value: string;
  href?: string;
  icon: React.ReactNode;
  rightSlot?: React.ReactNode;
};

export function ContactCards() {
  const shouldReduce = useReducedMotion();

  const cards: CardData[] = [
    // Always shown. Until a real address replaces the `you@example.com` seed in
    // profile.ts, this displays the placeholder (the mailto/copy just point at
    // it); swapping in the real email upgrades it with no change here.
    {
      key: 'email',
      label: 'Email',
      value: profile.email,
      href: `mailto:${profile.email}`,
      icon: <Mail className="h-5 w-5 text-primary" />,
      rightSlot: <CopyEmailButton email={profile.email} />,
    },
    {
      key: 'github',
      label: 'GitHub',
      value: 'GitHub Profile',
      href: profile.github,
      icon: <GitHubIcon className="h-5 w-5 text-primary" />,
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      value: 'LinkedIn Profile',
      href: profile.linkedin,
      icon: <LinkedInIcon className="h-5 w-5 text-primary" />,
    },
    {
      key: 'location',
      label: 'Location',
      value: profile.location || 'Available Worldwide',
      icon: <MapPin className="h-5 w-5 text-primary" />,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((card, i) => {
          const content = (
            <>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                {card.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="uppercase text-muted-foreground"
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                  }}
                >
                  {card.label}
                </p>
                <p
                  className="mt-0.5 truncate text-foreground"
                  style={{ fontSize: '0.875rem', fontWeight: 500 }}
                >
                  {card.value}
                </p>
              </div>
              {card.rightSlot}
            </>
          );

          const className =
            'flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/25';

          const motionProps = shouldReduce
            ? {}
            : {
                initial: { opacity: 0, y: 14 },
                animate: { opacity: 1, y: 0 },
                transition: {
                  delay: 0.08 + i * 0.08,
                  duration: 0.5,
                  ease: [0.16, 1, 0.3, 1] as const,
                },
              };

          if (card.href) {
            return (
              <motion.a
                key={card.key}
                href={card.href}
                target={card.href.startsWith('mailto:') ? undefined : '_blank'}
                rel={
                  card.href.startsWith('mailto:')
                    ? undefined
                    : 'noopener noreferrer'
                }
                className={className}
                {...motionProps}
              >
                {content}
              </motion.a>
            );
          }

          return (
            <motion.div key={card.key} className={className} {...motionProps}>
              {content}
            </motion.div>
          );
        })}
      </div>

      <motion.p
        className="mt-10 text-muted-foreground"
        style={{ fontSize: '0.82rem' }}
        {...(shouldReduce
          ? {}
          : {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { delay: 0.5, duration: 0.5 },
            })}
      >
        I typically respond within 24–48 hours. For urgent inquiries, email is
        best.
      </motion.p>
    </>
  );
}
