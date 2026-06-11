'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

type CopyEmailButtonProps = {
  email: string;
};

export function CopyEmailButton({ email }: CopyEmailButtonProps) {
  const [copied, setCopied] = useState(false);
  const shouldReduce = useReducedMotion();

  async function handleCopy(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Email copied' : 'Copy email'}
      className={`ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        copied ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={shouldReduce ? {} : { scale: 0.6, opacity: 0 }}
            animate={shouldReduce ? {} : { scale: 1, opacity: 1 }}
            exit={shouldReduce ? {} : { scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="inline-flex"
          >
            <Check className="h-4 w-4" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={shouldReduce ? {} : { scale: 0.6, opacity: 0 }}
            animate={shouldReduce ? {} : { scale: 1, opacity: 1 }}
            exit={shouldReduce ? {} : { scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="inline-flex"
          >
            <Copy className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
