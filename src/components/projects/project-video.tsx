'use client';

import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { PlayIcon } from 'lucide-react';

import { clientEnv } from '@/lib/env.client';

function videoUrl(storagePath: string) {
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/${storagePath}`;
}

function screenshotUrl(storagePath: string) {
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
}

type ProjectVideoProps = {
  /** Path to the video inside the `videos` storage bucket. */
  videoPath: string;
  /** Optional poster: a screenshot storage path shown before playback. */
  posterPath: string | null;
  projectTitle: string;
};

/**
 * Hero demo-video player shown at the top of a project page. Before the first
 * play it shows the poster (the project's first screenshot, if any) with a
 * large play affordance; once started it hands off to the browser's native,
 * keyboard-accessible video controls. Entrance animation respects
 * prefers-reduced-motion, matching the rest of the project surfaces.
 */
export function ProjectVideo({
  videoPath,
  posterPath,
  projectTitle,
}: ProjectVideoProps) {
  const shouldReduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [started, setStarted] = useState(false);

  function start() {
    setStarted(true);
    const video = videoRef.current;
    if (!video) return;
    // Best-effort: if play is blocked/unsupported the native controls (now
    // shown) still let the user start it. Guard the call so environments where
    // play() is absent or returns a non-Promise don't throw.
    try {
      const result = video.play();
      if (result && typeof result.catch === 'function') {
        result.catch(() => undefined);
      }
    } catch {
      // Ignore — controls are visible.
    }
  }

  return (
    <motion.div
      {...(shouldReduce
        ? {}
        : {
            initial: { opacity: 0, y: 12 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
          })}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
        <video
          ref={videoRef}
          src={videoUrl(videoPath)}
          poster={posterPath ? screenshotUrl(posterPath) : undefined}
          controls={started}
          playsInline
          preload="metadata"
          onPlay={() => setStarted(true)}
          aria-label={`${projectTitle} demo video`}
          className="h-full w-full object-contain"
        />

        {!started && (
          <>
            <button
              type="button"
              onClick={start}
              aria-label={`Play demo video for ${projectTitle}`}
              className="group absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30 transition-colors hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg backdrop-blur transition-transform group-hover:scale-105">
                <PlayIcon className="size-7 translate-x-0.5 fill-current" />
              </span>
            </button>
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
              Demo
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
}
