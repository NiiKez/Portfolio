'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface PageHeaderProps {
  title: string;
  description: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, className }: PageHeaderProps) {
  const shouldReduce = useReducedMotion();

  const animation = shouldReduce
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <motion.div {...animation} className={className}>
      <h1
        style={{
          fontSize: 'clamp(2.4rem, 6vw, 3.6rem)',
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
        }}
      >
        {title}
      </h1>
      <p className="mt-3 text-muted-foreground" style={{ lineHeight: 1.7 }}>
        {description}
      </p>
    </motion.div>
  );
}
