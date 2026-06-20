'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

type CopyEmailButtonProps = {
  email: string;
};

type CopyStatus = 'idle' | 'copied' | 'error';

/**
 * Copies `text` to the clipboard. Prefers the async Clipboard API but falls
 * back to a hidden-textarea `execCommand('copy')` when the API is unavailable
 * (insecure context / older browser) or rejects (permission denied), so the
 * copy still works in those cases. Never throws — it returns whether the copy
 * succeeded, so a rejection can't surface as an unhandled promise.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path below.
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    // Keep it out of the viewport so it never flashes or scrolls into view.
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function CopyEmailButton({ email }: CopyEmailButtonProps) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const shouldReduce = useReducedMotion();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending reset on unmount so the timer can't fire setState on an
  // unmounted component.
  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  async function handleCopy(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyToClipboard(email);
    setStatus(ok ? 'copied' : 'error');
    // Clear a prior timer so rapid re-clicks don't leave a stale reset queued.
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus('idle'), 2200);
  }

  const label =
    status === 'copied'
      ? 'Email copied'
      : status === 'error'
        ? 'Copy failed — select the address to copy it manually'
        : 'Copy email';

  const colorClass =
    status === 'copied'
      ? 'text-primary'
      : status === 'error'
        ? 'text-destructive'
        : 'text-muted-foreground hover:text-foreground';

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={`ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${colorClass}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={shouldReduce ? {} : { scale: 0.6, opacity: 0 }}
          animate={shouldReduce ? {} : { scale: 1, opacity: 1 }}
          exit={shouldReduce ? {} : { scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="inline-flex"
        >
          {status === 'copied' ? (
            <Check className="h-4 w-4" />
          ) : status === 'error' ? (
            <X className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
