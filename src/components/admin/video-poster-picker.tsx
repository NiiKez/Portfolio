'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CameraIcon, Loader2Icon, Trash2Icon, UploadIcon } from 'lucide-react';

import {
  removeProjectVideoPoster,
  setProjectVideoPoster,
} from '@/actions/videos';
import { Button } from '@/components/ui/button';
import { clientEnv as env } from '@/lib/env.client';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

function isAllowedMimeType(
  value: string,
): value is (typeof ALLOWED_MIME_TYPES)[number] {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

function videoUrl(storagePath: string) {
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/${storagePath}`;
}

function posterUrl(storagePath: string) {
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
}

// Object URLs power the staged preview. Guarded so non-browser environments
// (e.g. the test runner) degrade gracefully instead of throwing.
function createPreviewUrl(file: File): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(file);
  }
  return '';
}

function revokePreviewUrl(url: string) {
  if (
    url &&
    typeof URL !== 'undefined' &&
    typeof URL.revokeObjectURL === 'function'
  ) {
    URL.revokeObjectURL(url);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

type StagedPoster = { file: File; previewUrl: string };

type VideoPosterPickerProps = {
  projectId: string;
  /** Current demo video — the source the "capture a frame" player scrubs. */
  videoPath: string;
  initialPosterPath: string | null;
};

/**
 * Lets the admin give a demo video its own poster — the still shown before the
 * video plays — in two ways: capture a frame from the video (drawn to a canvas
 * and exported to a JPEG) or upload an image. Both converge on
 * `setProjectVideoPoster`. Decoupling the poster from the gallery means the
 * first screenshot is no longer shown twice (once as the poster, once in the
 * gallery) on the project page.
 */
export function VideoPosterPicker({
  projectId,
  videoPath,
  initialPosterPath,
}: VideoPosterPickerProps) {
  const [posterPath, setPosterPath] = useState(initialPosterPath);
  const [staged, setStaged] = useState<StagedPoster | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, startRemoveTransition] = useTransition();
  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  // Mirror of `staged` so the unmount cleanup can revoke a leftover URL without
  // re-subscribing the effect on every change.
  const stagedRef = useRef<StagedPoster | null>(null);

  useEffect(() => {
    setPosterPath(initialPosterPath);
  }, [initialPosterPath]);

  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);

  useEffect(
    () => () => {
      if (stagedRef.current) revokePreviewUrl(stagedRef.current.previewUrl);
    },
    [],
  );

  const busy = isCapturing || isUploading || isRemoving;

  function clearStaged() {
    setStaged((prev) => {
      if (prev) revokePreviewUrl(prev.previewUrl);
      return null;
    });
  }

  // Shared tail for both paths: POST the image to the server action and adopt
  // the returned path. Returns true on success so callers can clean up.
  async function uploadPoster(file: File): Promise<boolean> {
    const fd = new FormData();
    fd.append('project_id', projectId);
    fd.append('file', file);

    const response = await setProjectVideoPoster(fd);
    if (!response.success) {
      toast.error(response.error);
      return false;
    }
    setPosterPath(response.data.demo_video_poster_path);
    toast.success('Poster updated');
    return true;
  }

  async function handleCaptureFrame() {
    if (busy) return;
    const video = captureVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast.error('The video is still loading — try again in a moment.');
      return;
    }

    setIsCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.error('Could not capture a frame from this video.');
        return;
      }

      // The video is served cross-origin (Supabase) with `crossOrigin` set, so
      // the canvas is not tainted and `toBlob` can read it. The try/catch is a
      // safety net in case a browser still refuses (it throws SecurityError).
      const blob = await new Promise<Blob | null>((resolve) => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.92);
        } catch {
          resolve(null);
        }
      });

      if (!blob) {
        toast.error('Could not capture a frame from this video.');
        return;
      }

      const file = new File([blob], 'poster.jpg', { type: 'image/jpeg' });
      // A frame captured from a high-resolution (e.g. 4K) video can exceed the
      // 5MB cap. Guard here — same check the file-pick path uses — so the server
      // never rejects a capture the admin never explicitly chose.
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(
          'The captured frame is larger than 5MB. Try a lower-resolution video or upload an image instead.',
        );
        return;
      }
      const ok = await uploadPoster(file);
      if (ok) clearStaged();
    } finally {
      setIsCapturing(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so picking the same file again still fires a change event.
    event.target.value = '';
    if (!file) return;

    if (!isAllowedMimeType(file.type)) {
      toast.error('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('The image must be 5MB or smaller.');
      return;
    }

    setStaged((prev) => {
      if (prev) revokePreviewUrl(prev.previewUrl);
      return { file, previewUrl: createPreviewUrl(file) };
    });
  }

  async function handleUploadPoster() {
    if (!staged || busy) return;
    setIsUploading(true);
    try {
      const ok = await uploadPoster(staged.file);
      if (ok) clearStaged();
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemove() {
    startRemoveTransition(async () => {
      const response = await removeProjectVideoPoster({ projectId });
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      setPosterPath(null);
      toast.success('Poster removed');
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Video poster</p>
        {posterPath && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={busy}
            aria-label="Remove video poster"
            className="shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2Icon />
            Remove
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        The still shown before the video plays. Capture a frame from the video
        or upload your own image. If none is set, the video&rsquo;s own first
        frame is used.
      </p>

      {posterPath && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Current poster
          </p>
          <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-lg border border-border bg-muted">
            <Image
              key={posterPath}
              src={posterUrl(posterPath)}
              alt="Current video poster"
              fill
              sizes="384px"
              className="object-contain"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Capture a frame
        </p>
        <div className="overflow-hidden rounded-lg border border-border bg-black">
          <video
            ref={captureVideoRef}
            key={videoPath}
            src={videoUrl(videoPath)}
            crossOrigin="anonymous"
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Scrub to the frame you want, pause, then capture it.
          </p>
          <Button
            type="button"
            onClick={handleCaptureFrame}
            disabled={busy}
            className="shrink-0"
          >
            {isCapturing ? (
              <>
                <Loader2Icon className="animate-spin" />
                Capturing…
              </>
            ) : (
              <>
                <CameraIcon />
                Use current frame
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <label
          htmlFor="poster-file"
          className="text-xs font-medium text-muted-foreground"
        >
          Or upload an image (JPEG, PNG, or WebP — max 5MB)
        </label>
        <input
          id="poster-file"
          type="file"
          accept={ALLOWED_MIME_TYPES.join(',')}
          onChange={handleFileChange}
          disabled={busy}
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 disabled:pointer-events-none disabled:opacity-50"
        />

        {staged && (
          <div className="space-y-2">
            <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-lg border border-border bg-muted">
              {staged.previewUrl ? (
                // Local object-URL preview — a plain <img> avoids routing a
                // blob through the next/image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={staged.previewUrl}
                  alt=""
                  className="h-full w-full object-contain"
                />
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                {staged.file.name} · {formatBytes(staged.file.size)}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearStaged}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleUploadPoster}
                  disabled={busy}
                >
                  {isUploading ? (
                    <>
                      <Loader2Icon className="animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <UploadIcon />
                      Set as poster
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
