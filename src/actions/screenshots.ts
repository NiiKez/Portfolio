'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  actionError,
  actionSuccess,
  type ActionResponse,
} from '@/lib/action-response';
import { isAdminEmail } from '@/lib/admin-email';
import { logger } from '@/lib/logger';
import { assertReorderIdsExist, distinctReorderIds } from '@/lib/reorder';
import { safeAction } from '@/lib/safe-action';
import { createClient } from '@/lib/supabase/server';
import { reorderSchema, type ReorderInput } from '@/lib/validations';
import type { ProjectScreenshot } from '@/types';

function revalidateScreenshotSurfaces(projectId: string) {
  revalidatePath('/projects');
  revalidatePath('/');
  revalidatePath('/admin/projects');
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}`);
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type SniffedImage = { ext: string; contentType: string };

/**
 * Confirms a real image by inspecting magic bytes instead of trusting the
 * browser-supplied content-type. Returns the canonical extension + MIME, or
 * null if the bytes are not a supported image.
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

const uploadProjectIdSchema = z.uuid();
const uploadAltTextSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value));

const deleteScreenshotSchema = z.object({ id: z.uuid() });
type DeleteScreenshotInput = z.infer<typeof deleteScreenshotSchema>;

/**
 * Uploads a screenshot server-side. Because the input is `FormData` (not a
 * plain object), this mirrors `safeAction`'s shape by hand: auth check, generic
 * try/catch with structured logging, and an `ActionResponse` return value. The
 * upload runs through the authenticated server client and validates the file by
 * sniffing magic bytes rather than trusting `file.type`.
 */
export async function uploadScreenshot(
  formData: FormData,
): Promise<ActionResponse<ProjectScreenshot>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdminEmail(user.email)) {
      logger.warn('screenshots.upload: unauthorized', {
        action: 'screenshots.upload',
        userId: user?.id ?? null,
      });
      return actionError('Unauthorized');
    }

    const projectIdValue = formData.get('project_id');
    const altTextValue = formData.get('alt_text');
    const file = formData.get('file');

    const projectIdParsed = uploadProjectIdSchema.safeParse(projectIdValue);
    if (!projectIdParsed.success) {
      return actionError('Invalid project');
    }
    const project_id = projectIdParsed.data;

    const altTextParsed = uploadAltTextSchema.safeParse(
      altTextValue === null ? undefined : altTextValue,
    );
    if (!altTextParsed.success) {
      return actionError('Alt text must be 200 characters or fewer');
    }
    const alt_text = altTextParsed.data;

    if (!(file instanceof File)) {
      return actionError('A file is required');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return actionError('Image must be 5MB or smaller');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImage(bytes);
    if (!sniffed) {
      return actionError('Only JPEG, PNG, or WebP images are allowed');
    }

    const storagePath = `${project_id}/${crypto.randomUUID()}.${sniffed.ext}`;

    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: sniffed.contentType,
        upsert: false,
      });

    if (uploadError) {
      logger.error('screenshots.upload: storage upload failed', {
        action: 'screenshots.upload',
        error: uploadError.message,
      });
      return actionError('Something went wrong. Please try again.');
    }

    const { data: max, error: maxOrderError } = await supabase
      .from('project_screenshots')
      .select('sort_order')
      .eq('project_id', project_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxOrderError) {
      // Compensate: drop the just-uploaded file so a transient read error here
      // does not leave it orphaned (and never assign a colliding sort_order).
      await supabase.storage
        .from('screenshots')
        .remove([storagePath])
        .catch(() => undefined);
      throw maxOrderError;
    }

    const nextOrder = (max?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('project_screenshots')
      .insert({
        project_id,
        storage_path: storagePath,
        alt_text,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      // Compensate: drop the just-uploaded file so it is not orphaned without
      // a DB row pointing at it. Best-effort so it cannot mask the real error.
      await supabase.storage
        .from('screenshots')
        .remove([storagePath])
        .catch(() => undefined);
      throw error;
    }

    revalidateScreenshotSurfaces(project_id);
    return actionSuccess(data as ProjectScreenshot);
  } catch (error) {
    logger.error('screenshots.upload: unhandled error', {
      action: 'screenshots.upload',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError('Something went wrong. Please try again.');
  }
}

export const deleteScreenshot = safeAction<
  DeleteScreenshotInput,
  { id: string }
>({
  name: 'screenshots.delete',
  schema: deleteScreenshotSchema,
  handler: async ({ id }) => {
    const supabase = await createClient();

    const { data: row, error: fetchError } = await supabase
      .from('project_screenshots')
      .select('project_id, storage_path')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { project_id, storage_path } = row as {
      project_id: string;
      storage_path: string;
    };

    // Delete the DB row first; an orphaned storage file is far less harmful
    // than a row pointing at a file we may fail to delete.
    const { error: deleteError } = await supabase
      .from('project_screenshots')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    if (storage_path) {
      // Best-effort: a storage failure must not fail the action.
      await supabase.storage
        .from('screenshots')
        .remove([storage_path])
        .catch(() => undefined);
    }

    revalidateScreenshotSurfaces(project_id);
    return { id };
  },
});

export const reorderScreenshots = safeAction<ReorderInput, { count: number }>({
  name: 'screenshots.reorder',
  schema: reorderSchema,
  handler: async (items) => {
    const supabase = await createClient();
    const ids = distinctReorderIds(items);

    const { data: rows, error: fetchError } = await supabase
      .from('project_screenshots')
      .select('id, project_id')
      .in('id', ids);
    if (fetchError) throw fetchError;

    const found = rows ?? [];
    assertReorderIdsExist(
      ids,
      found.map((row) => row.id),
    );

    // A reorder payload must stay within one project; ids spanning multiple
    // projects (a malformed/stale request) would shuffle sort_order across
    // projects in a single wholesale UPDATE.
    const projectIds = new Set(found.map((row) => row.project_id));
    if (projectIds.size > 1) {
      throw new Error('reorder: screenshots span multiple projects');
    }

    // Single atomic statement instead of one UPDATE per row.
    const { error } = await supabase.rpc('reorder_project_screenshots', {
      items,
    });
    if (error) throw error;

    for (const projectId of projectIds) {
      revalidateScreenshotSurfaces(projectId);
    }

    return { count: ids.length };
  },
});
