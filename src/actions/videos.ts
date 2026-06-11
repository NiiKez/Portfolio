'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  actionError,
  actionSuccess,
  type ActionResponse,
} from '@/lib/action-response';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { safeAction } from '@/lib/safe-action';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

function revalidateVideoSurfaces(projectId: string) {
  revalidatePath('/projects');
  revalidatePath('/');
  revalidatePath('/admin/projects');
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}`);
}

const VIDEO_BUCKET = 'videos';

// The demo-video poster is an image, so it lives in the `screenshots` bucket
// (public read, admin write) alongside the gallery images. It is referenced
// only by `projects.demo_video_poster_path` — never inserted as a
// `project_screenshots` row — so it stays out of the gallery.
const POSTER_BUCKET = 'screenshots';
const MAX_POSTER_SIZE_BYTES = 5 * 1024 * 1024;

type SniffedImage = { ext: string; contentType: string };

/**
 * Confirms a real image by inspecting magic bytes rather than trusting the
 * browser-supplied content-type — mirrors the screenshot uploader so a poster
 * (uploaded or captured from a video frame) is validated the same way.
 */
function sniffImage(bytes: Uint8Array): SniffedImage | null {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) {
    return { ext: 'png', contentType: 'image/png' };
  }

  // WebP: "RIFF" (52 49 46 46) at 0..3 and "WEBP" (57 45 42 50) at 8..11
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ext: 'webp', contentType: 'image/webp' };
  }

  return null;
}

// "<project_id>/<uuid>.<ext>" — a UUID-named object inside the project's folder.
// Loose UUID matching is fine here; the `startsWith` refine ties the object to
// the project and the bucket's own `allowed_mime_types` is the real gate on
// content. Keeping this tight stops a caller from pointing the row at an
// arbitrary storage object (e.g. another project's folder).
const STORAGE_PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|webm)$/i;

const setProjectVideoSchema = z
  .object({
    projectId: z.uuid(),
    storagePath: z.string().trim().min(1).max(300),
  })
  .refine((value) => value.storagePath.startsWith(`${value.projectId}/`), {
    message: 'Video does not belong to this project',
    path: ['storagePath'],
  })
  .refine((value) => STORAGE_PATH_RE.test(value.storagePath), {
    message: 'Invalid video path',
    path: ['storagePath'],
  });

type SetProjectVideoInput = z.infer<typeof setProjectVideoSchema>;

const VIDEO_EXTENSIONS = ['mp4', 'webm'] as const;

const createVideoUploadUrlSchema = z.object({
  projectId: z.uuid(),
  ext: z.enum(VIDEO_EXTENSIONS),
});
type CreateVideoUploadUrlInput = z.infer<typeof createVideoUploadUrlSchema>;

const removeProjectVideoSchema = z.object({ projectId: z.uuid() });
type RemoveProjectVideoInput = z.infer<typeof removeProjectVideoSchema>;

/**
 * Authorises a browser upload to the admin-only `videos` bucket. The caller is
 * verified as the admin by `safeAction` before this runs; a short-lived signed
 * upload URL is then minted so the file can stream straight from the browser to
 * storage — large videos never pass through a Server Action body. The URL is
 * minted with the service-role client (see `createAdminClient`): the admin
 * panel's storage policies on this shared Supabase instance diverge from this
 * repo's migrations, so gating at the action layer + service-role minting is
 * the reliable path. Direct (non-admin) writes to the bucket remain blocked by
 * Storage RLS. The storage path is generated here, not supplied by the caller,
 * so an upload can only ever land inside the project's own folder.
 */
export const createVideoUploadUrl = safeAction<
  CreateVideoUploadUrlInput,
  { path: string; token: string }
>({
  name: 'videos.createUploadUrl',
  schema: createVideoUploadUrlSchema,
  handler: async ({ projectId, ext }) => {
    const storagePath = `${projectId}/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await createAdminClient()
      .storage.from(VIDEO_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (error) throw error;

    return { path: storagePath, token: data.token };
  },
});

/**
 * Records (or replaces) a project's demo video. The file itself is uploaded
 * directly from the browser to the `videos` bucket — large videos would blow
 * past the Server Action body limit — so this action only validates and stores
 * the resulting path. It confirms the object actually exists (and looks like a
 * video) before writing the row, then best-effort removes any previous video so
 * replacing one does not orphan storage.
 */
export const setProjectVideo = safeAction<
  SetProjectVideoInput,
  { demo_video_path: string }
>({
  name: 'videos.set',
  schema: setProjectVideoSchema,
  handler: async ({ projectId, storagePath }) => {
    const supabase = await createClient();
    // Storage RLS on this shared instance diverges from the repo, so storage
    // operations use the service-role client (the action is already admin-
    // gated); the `projects` table stays on the authenticated client so its
    // own RLS keeps protecting writes.
    const storage = createAdminClient().storage;

    // Confirm the just-uploaded object is real before pointing a row at it.
    const filename = storagePath.slice(storagePath.indexOf('/') + 1);
    const { data: listed, error: listError } = await storage
      .from(VIDEO_BUCKET)
      .list(projectId, { search: filename, limit: 1 });
    if (listError) throw listError;

    const object = listed?.find((item) => item.name === filename);
    if (!object) {
      // The compensation path the client runs on a failed set-call removes the
      // upload, so a missing object here is an unexpected, unrecoverable state.
      logger.warn('videos.set: object missing in storage', {
        action: 'videos.set',
        projectId,
      });
      throw new Error('Uploaded video could not be found');
    }

    // Defence in depth: the bucket already restricts `allowed_mime_types`, but
    // reject anything that slipped through as a non-video. Tolerate a missing
    // mimetype (not all storage backends populate it on `list`).
    const mimetype = (object.metadata as { mimetype?: string } | null)
      ?.mimetype;
    if (mimetype && !mimetype.startsWith('video/')) {
      await storage
        .from(VIDEO_BUCKET)
        .remove([storagePath])
        .catch(() => undefined);
      throw new Error('Uploaded file is not a video');
    }

    const { data: current } = await supabase
      .from('projects')
      .select('demo_video_path')
      .eq('id', projectId)
      .maybeSingle();
    const previousPath = (current as { demo_video_path: string | null } | null)
      ?.demo_video_path;

    // `.select('id').single()` makes a 0-row match (e.g. the project was
    // deleted between upload and now) surface as an error (PGRST116) instead of
    // a silent no-op success that would orphan the just-uploaded object.
    const { error: updateError } = await supabase
      .from('projects')
      .update({ demo_video_path: storagePath })
      .eq('id', projectId)
      .select('id')
      .single();
    if (updateError) {
      // Compensate: drop the orphaned upload so it is not left without a row.
      await storage
        .from(VIDEO_BUCKET)
        .remove([storagePath])
        .catch(() => undefined);
      throw updateError;
    }

    if (previousPath && previousPath !== storagePath) {
      // Best-effort: a storage failure must not fail the action.
      await storage
        .from(VIDEO_BUCKET)
        .remove([previousPath])
        .catch(() => undefined);
    }

    revalidateVideoSurfaces(projectId);
    return { demo_video_path: storagePath };
  },
});

/**
 * Best-effort cleanup for a browser upload that reached storage but was never
 * recorded on a row (e.g. `setProjectVideo` failed straight after). The browser
 * cannot delete from the admin-only bucket itself, so it delegates to this
 * admin-gated action. The path is validated exactly as `setProjectVideo`
 * validates it, so a caller can only ever target an object in its own project's
 * folder. A failed removal is swallowed — the file is already orphaned and the
 * user can do nothing about it, so this must not surface as an error.
 */
export const discardVideoUpload = safeAction<
  SetProjectVideoInput,
  { discarded: boolean }
>({
  name: 'videos.discardUpload',
  schema: setProjectVideoSchema,
  handler: async ({ projectId, storagePath }) => {
    // Storage-only cleanup → service-role client (action is already admin-gated).
    const { error } = await createAdminClient()
      .storage.from(VIDEO_BUCKET)
      .remove([storagePath]);
    if (error) {
      logger.warn('videos.discardUpload: cleanup failed', {
        action: 'videos.discardUpload',
        projectId,
      });
    }
    return { discarded: !error };
  },
});

/**
 * Clears a project's demo video: nulls the column, then best-effort removes the
 * file. The DB write happens first — an orphaned storage file is far less
 * harmful than a row pointing at a file we may fail to delete.
 */
export const removeProjectVideo = safeAction<
  RemoveProjectVideoInput,
  { projectId: string }
>({
  name: 'videos.remove',
  schema: removeProjectVideoSchema,
  handler: async ({ projectId }) => {
    const supabase = await createClient();

    const { data: current, error: fetchError } = await supabase
      .from('projects')
      .select('demo_video_path, demo_video_poster_path')
      .eq('id', projectId)
      .maybeSingle();
    if (fetchError) throw fetchError;

    const row = current as {
      demo_video_path: string | null;
      demo_video_poster_path: string | null;
    } | null;
    const previousPath = row?.demo_video_path;
    const previousPosterPath = row?.demo_video_poster_path;

    // Removing the video also drops its poster — a poster with no video to
    // play is meaningless, and leaving the path set would orphan the image.
    // `.select('id').single()` makes a 0-row match (no such project) fail with
    // PGRST116 rather than report a no-op success.
    const { error: updateError } = await supabase
      .from('projects')
      .update({ demo_video_path: null, demo_video_poster_path: null })
      .eq('id', projectId)
      .select('id')
      .single();
    if (updateError) throw updateError;

    if (previousPath) {
      // Storage delete → service-role client (action is already admin-gated).
      await createAdminClient()
        .storage.from(VIDEO_BUCKET)
        .remove([previousPath])
        .catch(() => undefined);
    }

    if (previousPosterPath) {
      // The poster lives in the screenshots bucket, which the authenticated
      // client can write to (same path the screenshot uploader uses).
      await supabase.storage
        .from(POSTER_BUCKET)
        .remove([previousPosterPath])
        .catch(() => undefined);
    }

    revalidateVideoSurfaces(projectId);
    return { projectId };
  },
});

/**
 * Sets (or replaces) a project's demo-video poster — the still shown before the
 * video plays. The image arrives as `FormData` (either an uploaded file or a
 * frame the admin captured from the video, exported to a JPEG on a canvas), so
 * this mirrors `uploadScreenshot`'s hand-rolled shape: explicit admin check,
 * magic-byte sniff, then upload to the `screenshots` bucket and point the
 * project row at it. Any previous poster file is best-effort cleaned up so
 * replacing one does not orphan storage.
 */
export async function setProjectVideoPoster(
  formData: FormData,
): Promise<ActionResponse<{ demo_video_poster_path: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.email !== env.ADMIN_EMAIL) {
      logger.warn('videos.setPoster: unauthorized', {
        action: 'videos.setPoster',
        userId: user?.id ?? null,
      });
      return actionError('Unauthorized');
    }

    const projectIdParsed = z.uuid().safeParse(formData.get('project_id'));
    if (!projectIdParsed.success) return actionError('Invalid project');
    const projectId = projectIdParsed.data;

    const file = formData.get('file');
    if (!(file instanceof File)) return actionError('A file is required');
    if (file.size > MAX_POSTER_SIZE_BYTES) {
      return actionError('Image must be 5MB or smaller');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImage(bytes);
    if (!sniffed) {
      return actionError('Only JPEG, PNG, or WebP images are allowed');
    }

    const storagePath = `${projectId}/poster-${crypto.randomUUID()}.${sniffed.ext}`;

    const { error: uploadError } = await supabase.storage
      .from(POSTER_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: sniffed.contentType,
        upsert: false,
      });
    if (uploadError) {
      logger.error('videos.setPoster: storage upload failed', {
        action: 'videos.setPoster',
        error: uploadError.message,
      });
      return actionError('Something went wrong. Please try again.');
    }

    // Read the previous poster so it can be removed after the row points at the
    // new one (delete-after-swap, so a failure never leaves the row danging).
    const { data: existing } = await supabase
      .from('projects')
      .select('demo_video_poster_path')
      .eq('id', projectId)
      .maybeSingle();
    const previousPosterPath = (
      existing as { demo_video_poster_path: string | null } | null
    )?.demo_video_poster_path;

    // `.select('id').single()` makes a 0-row match (no such project) surface as
    // an error (PGRST116) instead of a silent no-op success that would orphan
    // the poster just uploaded above.
    const { error: updateError } = await supabase
      .from('projects')
      .update({ demo_video_poster_path: storagePath })
      .eq('id', projectId)
      .select('id')
      .single();
    if (updateError) {
      // Compensate: drop the orphaned upload so it is not left without a row.
      await supabase.storage
        .from(POSTER_BUCKET)
        .remove([storagePath])
        .catch(() => undefined);
      logger.error('videos.setPoster: row update failed', {
        action: 'videos.setPoster',
        error: updateError.message,
      });
      return actionError('Something went wrong. Please try again.');
    }

    if (previousPosterPath && previousPosterPath !== storagePath) {
      await supabase.storage
        .from(POSTER_BUCKET)
        .remove([previousPosterPath])
        .catch(() => undefined);
    }

    revalidateVideoSurfaces(projectId);
    return actionSuccess({ demo_video_poster_path: storagePath });
  } catch (error) {
    logger.error('videos.setPoster: unhandled error', {
      action: 'videos.setPoster',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError('Something went wrong. Please try again.');
  }
}

/**
 * Clears a project's demo-video poster: nulls the column, then best-effort
 * removes the image. The DB write happens first — an orphaned storage file is
 * far less harmful than a row pointing at a file we may fail to delete.
 */
export const removeProjectVideoPoster = safeAction<
  RemoveProjectVideoInput,
  { projectId: string }
>({
  name: 'videos.removePoster',
  schema: removeProjectVideoSchema,
  handler: async ({ projectId }) => {
    const supabase = await createClient();

    const { data: current, error: fetchError } = await supabase
      .from('projects')
      .select('demo_video_poster_path')
      .eq('id', projectId)
      .maybeSingle();
    if (fetchError) throw fetchError;

    const previousPosterPath = (
      current as { demo_video_poster_path: string | null } | null
    )?.demo_video_poster_path;

    // `.select('id').single()` makes a 0-row match (no such project) fail with
    // PGRST116 rather than report a no-op success.
    const { error: updateError } = await supabase
      .from('projects')
      .update({ demo_video_poster_path: null })
      .eq('id', projectId)
      .select('id')
      .single();
    if (updateError) throw updateError;

    if (previousPosterPath) {
      await supabase.storage
        .from(POSTER_BUCKET)
        .remove([previousPosterPath])
        .catch(() => undefined);
    }

    revalidateVideoSurfaces(projectId);
    return { projectId };
  },
});
