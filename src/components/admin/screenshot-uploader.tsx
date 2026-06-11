'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  ImagePlusIcon,
  Loader2Icon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react';

import {
  deleteScreenshot,
  reorderScreenshots,
  uploadScreenshot,
} from '@/actions/screenshots';
import { SortableList } from '@/components/admin/sortable-list';
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
import { Input } from '@/components/ui/input';
import { clientEnv as env } from '@/lib/env.client';
import type { ProjectScreenshot } from '@/types';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

function isAllowedMimeType(
  value: string,
): value is (typeof ALLOWED_MIME_TYPES)[number] {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

function publicUrl(storagePath: string) {
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
}

// Object URLs power the staged previews. Guarded so non-browser environments
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

// A file selected client-side and waiting to be uploaded.
type StagedFile = {
  id: string;
  file: File;
  previewUrl: string;
  alt: string;
};

type ScreenshotUploaderProps = {
  projectId: string;
  initialScreenshots: ProjectScreenshot[];
};

export function ScreenshotUploader({
  projectId,
  initialScreenshots,
}: ScreenshotUploaderProps) {
  const [screenshots, setScreenshots] = useState(initialScreenshots);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<ProjectScreenshot | null>(
    null,
  );
  const [isDeleting, startDeleteTransition] = useTransition();
  const [, startReorderTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Mirror of `staged` so the unmount cleanup can revoke any leftover URLs
  // without re-subscribing the effect on every change.
  const stagedRef = useRef<StagedFile[]>([]);

  useEffect(() => {
    setScreenshots(initialScreenshots);
  }, [initialScreenshots]);

  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);

  useEffect(
    () => () => {
      stagedRef.current.forEach((item) => revokePreviewUrl(item.previewUrl));
    },
    [],
  );

  function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Reset so picking the same file again still fires a change event.
    event.target.value = '';
    if (files.length === 0) return;

    const accepted: StagedFile[] = [];
    let rejectedType = 0;
    let rejectedSize = 0;

    for (const file of files) {
      if (!isAllowedMimeType(file.type)) {
        rejectedType += 1;
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejectedSize += 1;
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: createPreviewUrl(file),
        alt: '',
      });
    }

    if (rejectedType > 0) {
      toast.error('Only JPEG, PNG, or WebP images are allowed.');
    }
    if (rejectedSize > 0) {
      toast.error('Each image must be 5MB or smaller.');
    }
    if (accepted.length > 0) {
      setStaged((prev) => [...prev, ...accepted]);
    }
  }

  function removeStaged(id: string) {
    setStaged((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) revokePreviewUrl(target.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }

  function clearStaged() {
    setStaged((prev) => {
      prev.forEach((s) => revokePreviewUrl(s.previewUrl));
      return [];
    });
  }

  function updateStagedAlt(id: string, alt: string) {
    setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, alt } : s)));
  }

  async function handleUpload() {
    if (staged.length === 0 || isUploading) return;

    // Snapshot the queue so removing succeeded items mid-loop is safe.
    const queue = [...staged];
    setIsUploading(true);
    setUploadTotal(queue.length);
    setUploadedCount(0);

    let succeeded = 0;

    for (const item of queue) {
      const fd = new FormData();
      fd.append('file', item.file);
      fd.append('project_id', projectId);
      const trimmedAlt = item.alt.trim();
      if (trimmedAlt !== '') fd.append('alt_text', trimmedAlt);

      const response = await uploadScreenshot(fd);

      if (!response.success) {
        toast.error(`${item.file.name}: ${response.error}`);
        continue;
      }

      succeeded += 1;
      setUploadedCount(succeeded);
      setScreenshots((prev) => [...prev, response.data]);
      setStaged((prev) => {
        revokePreviewUrl(item.previewUrl);
        return prev.filter((s) => s.id !== item.id);
      });
    }

    setIsUploading(false);

    // Per-file failures were already surfaced via toast inside the loop.
    if (succeeded === 1) {
      toast.success('Screenshot uploaded');
    } else if (succeeded > 1) {
      toast.success(`${succeeded} screenshots uploaded`);
    }
  }

  function handleReorder(reordered: ProjectScreenshot[]) {
    const previous = screenshots;
    setScreenshots(reordered);
    startReorderTransition(async () => {
      const items = reordered.map((s, index) => ({
        id: s.id,
        sort_order: index,
      }));
      const response = await reorderScreenshots(items);
      if (!response.success) {
        toast.error(response.error);
        setScreenshots(previous);
      }
    });
  }

  function handleDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;

    startDeleteTransition(async () => {
      const response = await deleteScreenshot({ id: target.id });
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      setScreenshots((prev) => prev.filter((s) => s.id !== target.id));
      setPendingDelete(null);
      toast.success('Screenshot deleted');
    });
  }

  const stagedCount = staged.length;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium">Add screenshots</p>
        <div className="space-y-1.5">
          <label
            htmlFor="screenshot-files"
            className="text-xs font-medium text-muted-foreground"
          >
            Images (JPEG, PNG, or WebP — max 5MB each). Select one or more.
          </label>
          <input
            id="screenshot-files"
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_MIME_TYPES.join(',')}
            onChange={handleFilesChange}
            disabled={isUploading}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 disabled:pointer-events-none disabled:opacity-50"
          />
        </div>

        {stagedCount > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {stagedCount} image{stagedCount === 1 ? '' : 's'} ready to
                upload
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearStaged}
                disabled={isUploading}
              >
                Clear all
              </Button>
            </div>

            <ul className="space-y-2">
              {staged.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5"
                >
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.previewUrl ? (
                      // Local object-URL preview — a plain <img> avoids routing
                      // a blob through the next/image optimizer.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImagePlusIcon className="size-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-xs text-muted-foreground">
                      {item.file.name} · {formatBytes(item.file.size)}
                    </p>
                    <Input
                      aria-label={`Alt text for ${item.file.name}`}
                      value={item.alt}
                      onChange={(e) => updateStagedAlt(item.id, e.target.value)}
                      disabled={isUploading}
                      maxLength={200}
                      placeholder="Alt text (optional)"
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeStaged(item.id)}
                    disabled={isUploading}
                    aria-label={`Remove ${item.file.name}`}
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleUpload}
                disabled={stagedCount === 0 || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2Icon className="animate-spin" />
                    Uploading {uploadedCount}/{uploadTotal}…
                  </>
                ) : (
                  <>
                    <UploadIcon />
                    Upload {stagedCount} image{stagedCount === 1 ? '' : 's'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {screenshots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No screenshots yet. Upload the first one above.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            The first image is the cover shown on cards and the project listing.
            Drag to reorder.
          </p>
          <SortableList
            items={screenshots}
            onReorder={handleReorder}
            renderItem={(screenshot, dragHandle, rowProps) => {
              const isCover = screenshots[0]?.id === screenshot.id;
              return (
                <div
                  ref={rowProps.ref as React.RefCallback<HTMLDivElement>}
                  style={rowProps.style}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  {dragHandle}
                  <div className="relative h-16 w-24 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={publicUrl(screenshot.storage_path)}
                      alt={screenshot.alt_text ?? ''}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                    {isCover && (
                      <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary-foreground">
                        Cover
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">
                      {screenshot.alt_text ?? (
                        <span className="text-muted-foreground italic">
                          No alt text
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {screenshot.storage_path}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPendingDelete(screenshot)}
                    aria-label="Delete screenshot"
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              );
            }}
          />
        </div>
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete screenshot?</DialogTitle>
            <DialogDescription>
              The image file will be removed from storage and this cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={isDeleting}>
                  Cancel
                </Button>
              }
            />
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
