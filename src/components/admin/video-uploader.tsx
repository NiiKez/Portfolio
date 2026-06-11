'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2Icon, Trash2Icon, UploadIcon, VideoIcon } from 'lucide-react';

import {
  createVideoUploadUrl,
  discardVideoUpload,
  removeProjectVideo,
  setProjectVideo,
} from '@/actions/videos';
import { VideoPosterPicker } from '@/components/admin/video-poster-picker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { clientEnv as env } from '@/lib/env.client';
import { createClient } from '@/lib/supabase/client';

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['video/mp4', 'video/webm'] as const;

type SniffedVideo = {
  ext: 'mp4' | 'webm';
  contentType: 'video/mp4' | 'video/webm';
};

function isAllowedMimeType(
  value: string,
): value is (typeof ALLOWED_MIME_TYPES)[number] {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Confirms a real video by inspecting magic bytes rather than trusting the
 * browser-supplied content-type, mirroring the screenshot uploader's approach.
 * Returns the canonical extension + MIME, or null if the bytes are not a
 * supported video container.
 */
function sniffVideo(bytes: Uint8Array): SniffedVideo | null {
  // MP4 / ISO-BMFF: a "ftyp" box marker (66 74 79 70) at offset 4.
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return { ext: 'mp4', contentType: 'video/mp4' };
  }

  // WebM / Matroska: EBML header 1A 45 DF A3.
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return { ext: 'webm', contentType: 'video/webm' };
  }

  return null;
}

async function detectVideo(file: File): Promise<SniffedVideo | null> {
  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const sniffed = sniffVideo(header);
    if (sniffed) return sniffed;
    // Bytes were readable but unrecognised — reject rather than trust the type.
    return null;
  } catch {
    // Could not read the bytes (an unusual runtime). Fall back to the declared
    // type, which we already validated against the allow-list.
    if (file.type === 'video/mp4')
      return { ext: 'mp4', contentType: 'video/mp4' };
    if (file.type === 'video/webm')
      return { ext: 'webm', contentType: 'video/webm' };
    return null;
  }
}

function publicUrl(storagePath: string) {
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/${storagePath}`;
}

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

type StagedVideo = {
  file: File;
  previewUrl: string;
  sniffed: SniffedVideo;
};

type VideoUploaderProps = {
  projectId: string;
  initialVideoPath: string | null;
  initialPosterPath?: string | null;
};

export function VideoUploader({
  projectId,
  initialVideoPath,
  initialPosterPath = null,
}: VideoUploaderProps) {
  const [videoPath, setVideoPath] = useState(initialVideoPath);
  const [staged, setStaged] = useState<StagedVideo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(false);
  const [isRemoving, startRemoveTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Mirror of `staged` so the unmount cleanup can revoke a leftover URL without
  // re-subscribing the effect on every change.
  const stagedRef = useRef<StagedVideo | null>(null);

  useEffect(() => {
    setVideoPath(initialVideoPath);
  }, [initialVideoPath]);

  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);

  useEffect(
    () => () => {
      if (stagedRef.current) revokePreviewUrl(stagedRef.current.previewUrl);
    },
    [],
  );

  function clearStaged() {
    setStaged((prev) => {
      if (prev) revokePreviewUrl(prev.previewUrl);
      return null;
    });
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so picking the same file again still fires a change event.
    event.target.value = '';
    if (!file) return;

    if (!isAllowedMimeType(file.type)) {
      toast.error('Only MP4 or WebM videos are allowed.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('The video must be 100MB or smaller.');
      return;
    }

    const sniffed = await detectVideo(file);
    if (!sniffed) {
      toast.error('Only MP4 or WebM videos are allowed.');
      return;
    }

    setStaged((prev) => {
      if (prev) revokePreviewUrl(prev.previewUrl);
      return { file, previewUrl: createPreviewUrl(file), sniffed };
    });
  }

  async function handleUpload() {
    if (!staged || isUploading) return;

    setIsUploading(true);
    // `uploadToSignedUrl` and `createClient` are direct Supabase calls (unlike
    // the safeAction-wrapped server actions, they can throw/reject). Wrap the
    // whole flow so `isUploading` is always reset and a stray rejection cannot
    // leave the button stuck spinning.
    try {
      // Authorise the upload server-side (the admin session is verified there)
      // and mint a one-time signed upload URL. The browser then streams the
      // file straight to storage with that token: large videos never pass
      // through a Server Action body, and the browser client does not need
      // write rights on the admin-only bucket. The server generates the path.
      const ticket = await createVideoUploadUrl({
        projectId,
        ext: staged.sniffed.ext,
      });
      if (!ticket.success) {
        toast.error(ticket.error);
        return;
      }

      const { path: storagePath, token } = ticket.data;
      const supabase = createClient();

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .uploadToSignedUrl(storagePath, token, staged.file, {
          contentType: staged.sniffed.contentType,
        });

      if (uploadError) {
        toast.error(uploadError.message || 'Upload failed. Please try again.');
        return;
      }

      const response = await setProjectVideo({ projectId, storagePath });

      if (!response.success) {
        // Compensate: the row was not updated, so drop the orphaned upload. The
        // browser cannot delete from the admin-only bucket, so this goes
        // through the admin-gated action. The signed token is one-time and the
        // object is now gone, so clear the stale staged file — a retry must
        // start from a fresh pick rather than re-using the consumed ticket.
        await discardVideoUpload({ projectId, storagePath });
        clearStaged();
        toast.error(response.error);
        return;
      }

      setVideoPath(response.data.demo_video_path);
      clearStaged();
      toast.success('Demo video uploaded');
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemove() {
    startRemoveTransition(async () => {
      const response = await removeProjectVideo({ projectId });
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      setVideoPath(null);
      setPendingRemove(false);
      toast.success('Demo video removed');
    });
  }

  const busy = isUploading || isRemoving;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium">
          {videoPath ? 'Replace demo video' : 'Add demo video'}
        </p>
        <div className="space-y-1.5">
          <label
            htmlFor="video-file"
            className="text-xs font-medium text-muted-foreground"
          >
            Video (MP4 or WebM — max 100MB). Shown as a player at the top of the
            project page.
          </label>
          <input
            id="video-file"
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME_TYPES.join(',')}
            onChange={handleFileChange}
            disabled={busy}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 disabled:pointer-events-none disabled:opacity-50"
          />
        </div>

        {staged && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-border bg-black">
              {staged.previewUrl ? (
                <video
                  src={staged.previewUrl}
                  controls
                  playsInline
                  className="aspect-video w-full"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center text-muted-foreground">
                  <VideoIcon className="size-6" />
                </div>
              )}
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
                <Button type="button" onClick={handleUpload} disabled={busy}>
                  {isUploading ? (
                    <>
                      <Loader2Icon className="animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <UploadIcon />
                      Upload video
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!staged &&
        (videoPath ? (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-lg border border-border bg-black">
              <video
                key={videoPath}
                src={publicUrl(videoPath)}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                {videoPath}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPendingRemove(true)}
                disabled={busy}
                aria-label="Remove demo video"
                className="shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2Icon />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No demo video yet. Upload one above.
          </div>
        ))}

      {videoPath && (
        <VideoPosterPicker
          projectId={projectId}
          videoPath={videoPath}
          initialPosterPath={initialPosterPath}
        />
      )}

      <Dialog
        open={pendingRemove}
        onOpenChange={(open) => {
          if (!open && !isRemoving) setPendingRemove(false);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove demo video?</DialogTitle>
            <DialogDescription>
              The video file will be removed from storage and this cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={isRemoving}>
                  Cancel
                </Button>
              }
            />
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              {isRemoving ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
