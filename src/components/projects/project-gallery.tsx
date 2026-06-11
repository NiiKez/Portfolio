'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Maximize2Icon,
  XIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { clientEnv } from '@/lib/env.client';
import { cn } from '@/lib/utils';
import type { ProjectScreenshot } from '@/types';

function publicUrl(storagePath: string) {
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
}

type ProjectGalleryProps = {
  screenshots: ProjectScreenshot[];
  projectTitle: string;
};

export function ProjectGallery({
  screenshots,
  projectTitle,
}: ProjectGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const total = screenshots.length;
  const safeIndex = total > 0 ? Math.min(activeIndex, total - 1) : 0;
  const hasMultiple = total > 1;

  const goPrev = () => setActiveIndex((i) => (i - 1 + total) % total);
  const goNext = () => setActiveIndex((i) => (i + 1) % total);

  // Keyboard control (Escape / arrows / focus trap), scroll lock, and
  // focus management (open: focus close button; close: restore the trigger)
  // while the lightbox is open.
  useEffect(() => {
    if (!lightboxOpen) return;

    // Remember the element that had focus when the lightbox opened (the
    // trigger), so focus can be restored to it on close.
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    triggerRef.current = trigger;

    function getFocusable(): HTMLElement[] {
      const root = overlayRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (el) =>
          !el.hasAttribute('disabled') &&
          el.getAttribute('aria-hidden') !== 'true',
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setLightboxOpen(false);
      } else if (event.key === 'ArrowLeft' && hasMultiple) {
        goPrev();
      } else if (event.key === 'ArrowRight' && hasMultiple) {
        goNext();
      } else if (event.key === 'Tab') {
        // Focus trap: keep Tab / Shift+Tab cycling within the overlay.
        const focusable = getFocusable();
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const activeEl =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const withinOverlay =
          activeEl != null && overlayRef.current?.contains(activeEl) === true;

        if (event.shiftKey) {
          if (!withinOverlay || activeEl === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (!withinOverlay || activeEl === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;

      // Restore focus to the trigger, guarding for null / removal from DOM.
      const toRestore = triggerRef.current;
      triggerRef.current = null;
      if (toRestore && document.contains(toRestore)) {
        toRestore.focus();
      }
    };
    // hasMultiple/total are stable for a given screenshot set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen]);

  if (total === 0) return null;

  const active = screenshots[safeIndex]!;
  const activeAlt =
    active.alt_text ?? `${projectTitle} screenshot ${safeIndex + 1}`;

  return (
    <div className="space-y-3">
      <div className="group relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label="View image full screen"
          className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            key={active.id}
            src={publicUrl(active.storage_path)}
            alt={activeAlt}
            width={1600}
            height={900}
            sizes="(min-width: 1024px) 960px, 100vw"
            className="h-full w-full object-contain"
            priority={safeIndex === 0}
          />
        </button>

        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-background/80 p-1.5 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
          <Maximize2Icon className="size-4" />
        </span>

        {hasMultiple && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={goPrev}
              aria-label="Previous screenshot"
              className="absolute left-2 top-1/2 -translate-y-1/2 shadow-sm"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={goNext}
              aria-label="Next screenshot"
              className="absolute right-2 top-1/2 -translate-y-1/2 shadow-sm"
            >
              <ChevronRightIcon />
            </Button>
            <div
              className="absolute bottom-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-xs text-foreground shadow-sm backdrop-blur"
              aria-live="polite"
            >
              {safeIndex + 1} / {total}
            </div>
          </>
        )}
      </div>

      {hasMultiple && (
        <ul
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label="Screenshot thumbnails"
        >
          {screenshots.map((shot, index) => {
            const isActive = index === safeIndex;
            return (
              <li key={shot.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`View screenshot ${index + 1}`}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'relative block h-16 w-24 overflow-hidden rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'border-primary'
                      : 'border-border hover:border-ring',
                  )}
                >
                  <Image
                    src={publicUrl(shot.storage_path)}
                    alt={
                      shot.alt_text ?? `${projectTitle} thumbnail ${index + 1}`
                    }
                    width={192}
                    height={128}
                    sizes="96px"
                    className="h-full w-full object-cover"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {lightboxOpen && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${projectTitle} image viewer`}
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
        >
          <div className="flex justify-end p-3">
            <Button
              ref={closeButtonRef}
              type="button"
              variant="secondary"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(false);
              }}
              aria-label="Close full screen view"
            >
              <XIcon />
            </Button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              key={active.id}
              src={publicUrl(active.storage_path)}
              alt={activeAlt}
              width={1920}
              height={1080}
              sizes="100vw"
              className="max-h-full w-auto max-w-full object-contain"
            />

            {hasMultiple && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={goPrev}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 -translate-y-1/2 shadow-sm"
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={goNext}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 -translate-y-1/2 shadow-sm"
                >
                  <ChevronRightIcon />
                </Button>
                <div
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-2.5 py-0.5 text-xs text-foreground shadow-sm backdrop-blur"
                  aria-live="polite"
                >
                  {safeIndex + 1} / {total}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
