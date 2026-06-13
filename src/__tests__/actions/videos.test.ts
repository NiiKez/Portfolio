import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    ADMIN_EMAIL: 'admin@example.com',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const authGetUser = vi.fn();
const fromMock = vi.fn();

// Per-method storage spies are shared across both clients (assertions about the
// bucket name and path use these); *which* client reached storage is asserted
// via the two distinct `*StorageFrom` spies below.
const storageList = vi.fn();
const storageRemove = vi.fn();
const storageUpload = vi.fn();
const storageCreateSignedUploadUrl = vi.fn();

function storageBucket() {
  return {
    list: storageList,
    remove: storageRemove,
    upload: storageUpload,
    createSignedUploadUrl: storageCreateSignedUploadUrl,
  };
}

// SECURITY CONTRACT: the admin-only `videos` bucket must be reached through the
// service-role client (createAdminClient) — signed upload URLs are minted
// server-side and this shared instance's storage RLS diverges from the repo —
// while the `screenshots` (poster) bucket is reached through the authenticated
// client (createClient). Two *distinct* `from` spies let a test prove that
// routing; the suite previously reused one spy for both, so a regression that
// swapped clients would have passed silently.
const authStorageFrom = vi.fn(storageBucket);
const adminStorageFrom = vi.fn(storageBucket);

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: authGetUser },
    from: fromMock,
    storage: { from: authStorageFrom },
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: { from: adminStorageFrom },
  })),
}));

import { revalidatePath } from 'next/cache';

import {
  createVideoUploadUrl,
  discardVideoUpload,
  removeProjectVideo,
  removeProjectVideoPoster,
  setProjectVideo,
  setProjectVideoPoster,
} from '@/actions/videos';

type SupabaseResult<T = unknown> = {
  data: T | null;
  error: { message?: string; code?: string } | null;
};

type ProjectsState = {
  // `.select(...).maybeSingle()` — the existence/previous-path read.
  maybeSingle: SupabaseResult;
  // `.update(...).eq('id', ...).select('id').single()` — the write terminal.
  // A 0-row update resolves to `{ data: null, error: { code: 'PGRST116' } }`.
  single: SupabaseResult;
};

function createProjectsChain(state: ProjectsState) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'update', 'eq']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => state.maybeSingle);
  chain.single = vi.fn(async () => state.single);
  return chain;
}

const projectId = '11111111-1111-4111-8111-111111111111';
const videoUuid = '22222222-2222-4222-8222-222222222222';
const storagePath = `${projectId}/${videoUuid}.mp4`;
const filename = `${videoUuid}.mp4`;

let projectsState: ProjectsState;

beforeEach(() => {
  vi.clearAllMocks();
  projectsState = {
    maybeSingle: { data: { demo_video_path: null }, error: null },
    single: { data: { id: projectId }, error: null },
  };
  fromMock.mockImplementation(() => createProjectsChain(projectsState));
  authGetUser.mockResolvedValue({
    data: { user: { id: 'admin-uid', email: 'admin@example.com' } },
  });
  storageList.mockResolvedValue({
    data: [{ name: filename, metadata: { mimetype: 'video/mp4' } }],
    error: null,
  });
  storageRemove.mockResolvedValue({ data: null, error: null });
  storageUpload.mockResolvedValue({ data: { path: 'x' }, error: null });
  storageCreateSignedUploadUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.test/upload', token: 'signed-token' },
    error: null,
  });
});

describe('setProjectVideo', () => {
  it('records the uploaded video path and revalidates surfaces', async () => {
    const result = await setProjectVideo({ projectId, storagePath });

    expect(result).toEqual({
      success: true,
      data: { demo_video_path: storagePath },
    });
    expect(adminStorageFrom).toHaveBeenCalledWith('videos');
    // The video bucket must never be reached through the authenticated client.
    expect(authStorageFrom).not.toHaveBeenCalled();
    expect(storageList).toHaveBeenCalledWith(projectId, {
      search: filename,
      limit: 1,
    });
    expect(fromMock).toHaveBeenCalledWith('projects');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`);
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('removes the previous video when replacing an existing one', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_path: `${projectId}/old.mp4` },
      error: null,
    };

    const result = await setProjectVideo({ projectId, storagePath });

    expect(result.success).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith([`${projectId}/old.mp4`]);
  });

  it('rejects a storage path that does not belong to the project', async () => {
    const result = await setProjectVideo({
      projectId,
      storagePath: `${videoUuid}/${videoUuid}.mp4`,
    });

    expect(result.success).toBe(false);
    expect(adminStorageFrom).not.toHaveBeenCalled();
    expect(authStorageFrom).not.toHaveBeenCalled();
  });

  it('rejects a path with a non-video extension', async () => {
    const result = await setProjectVideo({
      projectId,
      storagePath: `${projectId}/${videoUuid}.exe`,
    });

    expect(result.success).toBe(false);
    expect(adminStorageFrom).not.toHaveBeenCalled();
    expect(authStorageFrom).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({ data: { user: null } });

    const result = await setProjectVideo({ projectId, storagePath });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(adminStorageFrom).not.toHaveBeenCalled();
    expect(authStorageFrom).not.toHaveBeenCalled();
  });

  it('fails when the uploaded object cannot be found in storage', async () => {
    storageList.mockResolvedValue({ data: [], error: null });

    const result = await setProjectVideo({ projectId, storagePath });

    expect(result.success).toBe(false);
    // No row should have been written.
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('fails when listing storage errors', async () => {
    storageList.mockResolvedValue({
      data: null,
      error: { message: 'list boom' },
    });

    const result = await setProjectVideo({ projectId, storagePath });

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects and removes the object when it is not a video', async () => {
    storageList.mockResolvedValue({
      data: [{ name: filename, metadata: { mimetype: 'application/pdf' } }],
      error: null,
    });

    const result = await setProjectVideo({ projectId, storagePath });

    expect(result.success).toBe(false);
    expect(storageRemove).toHaveBeenCalledWith([storagePath]);
  });

  it('rejects and removes the object when it exceeds the size limit', async () => {
    storageList.mockResolvedValue({
      data: [
        {
          name: filename,
          metadata: { mimetype: 'video/mp4', size: 100 * 1024 * 1024 + 1 },
        },
      ],
      error: null,
    });

    const result = await setProjectVideo({ projectId, storagePath });

    expect(result.success).toBe(false);
    // The oversized upload must be dropped and no row written.
    expect(storageRemove).toHaveBeenCalledWith([storagePath]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('accepts an object whose size is within the limit', async () => {
    storageList.mockResolvedValue({
      data: [
        {
          name: filename,
          metadata: { mimetype: 'video/mp4', size: 100 * 1024 * 1024 },
        },
      ],
      error: null,
    });

    const result = await setProjectVideo({ projectId, storagePath });

    expect(result.success).toBe(true);
  });

  it('compensates by removing the upload when the row update fails', async () => {
    projectsState.single = {
      data: null,
      error: { message: 'update boom' },
    };

    const result = await setProjectVideo({ projectId, storagePath });

    expect(result.success).toBe(false);
    expect(storageRemove).toHaveBeenCalledWith([storagePath]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('fails and removes the upload when the project does not exist (0-row update)', async () => {
    // A 0-row update is what supabase-js returns from `.single()` as PGRST116;
    // the action must treat it as failure and compensate the orphaned upload.
    projectsState.single = {
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    };

    const result = await setProjectVideo({ projectId, storagePath });

    expect(result.success).toBe(false);
    expect(storageRemove).toHaveBeenCalledWith([storagePath]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('createVideoUploadUrl', () => {
  it('mints a signed upload URL for a project-scoped path', async () => {
    const result = await createVideoUploadUrl({ projectId, ext: 'mp4' });

    expect(result.success).toBe(true);
    expect(adminStorageFrom).toHaveBeenCalledWith('videos');
    const signedPath = storageCreateSignedUploadUrl.mock.calls[0]![0];
    expect(signedPath).toMatch(
      new RegExp(`^${projectId}/[0-9a-f-]+\\.mp4$`, 'i'),
    );
    expect(result).toEqual({
      success: true,
      data: { path: signedPath, token: 'signed-token' },
    });
  });

  it('rejects an unsupported extension', async () => {
    const result = await createVideoUploadUrl({ projectId, ext: 'mov' });

    expect(result.success).toBe(false);
    expect(storageCreateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({ data: { user: null } });

    const result = await createVideoUploadUrl({ projectId, ext: 'mp4' });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(storageCreateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('fails when signing the upload URL errors', async () => {
    storageCreateSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: 'sign boom' },
    });

    const result = await createVideoUploadUrl({ projectId, ext: 'mp4' });

    expect(result.success).toBe(false);
  });
});

describe('discardVideoUpload', () => {
  it('removes an orphaned upload from the bucket', async () => {
    const result = await discardVideoUpload({ projectId, storagePath });

    expect(result).toEqual({ success: true, data: { discarded: true } });
    expect(adminStorageFrom).toHaveBeenCalledWith('videos');
    expect(storageRemove).toHaveBeenCalledWith([storagePath]);
  });

  it('rejects a path that does not belong to the project', async () => {
    const result = await discardVideoUpload({
      projectId,
      storagePath: `${videoUuid}/${videoUuid}.mp4`,
    });

    expect(result.success).toBe(false);
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it('still succeeds when the storage removal fails', async () => {
    storageRemove.mockResolvedValue({
      data: null,
      error: { message: 'remove boom' },
    });

    const result = await discardVideoUpload({ projectId, storagePath });

    expect(result).toEqual({ success: true, data: { discarded: false } });
  });
});

describe('removeProjectVideo', () => {
  it('clears the column and removes the stored file', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_path: storagePath },
      error: null,
    };

    const result = await removeProjectVideo({ projectId });

    expect(result).toEqual({ success: true, data: { projectId } });
    expect(adminStorageFrom).toHaveBeenCalledWith('videos');
    expect(storageRemove).toHaveBeenCalledWith([storagePath]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`);
  });

  it('succeeds without touching storage when there is no video', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_path: null },
      error: null,
    };

    const result = await removeProjectVideo({ projectId });

    expect(result.success).toBe(true);
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid project id', async () => {
    const result = await removeProjectVideo({ projectId: 'nope' });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns an error when the lookup fails', async () => {
    projectsState.maybeSingle = {
      data: null,
      error: { message: 'lookup boom' },
    };

    const result = await removeProjectVideo({ projectId });

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns an error and leaves the file when nulling the column fails', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_path: storagePath },
      error: null,
    };
    projectsState.single = {
      data: null,
      error: { message: 'update boom' },
    };

    const result = await removeProjectVideo({ projectId });

    expect(result.success).toBe(false);
    // The DB write failed, so storage must be untouched and nothing revalidated.
    expect(storageRemove).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns an error when the project does not exist (0-row update)', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_path: storagePath },
      error: null,
    };
    projectsState.single = {
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    };

    const result = await removeProjectVideo({ projectId });

    expect(result.success).toBe(false);
    // A 0-row update must not touch storage or revalidate.
    expect(storageRemove).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// --- Poster fixtures --------------------------------------------------------

const JPEG_SIG = [0xff, 0xd8, 0xff];
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function jpegFile(name = 'poster.jpg'): File {
  return new File([new Uint8Array(JPEG_SIG)], name, { type: 'image/jpeg' });
}

function pngFile(name = 'poster.png'): File {
  return new File([new Uint8Array(PNG_SIG)], name, { type: 'image/png' });
}

function webpFile(name = 'poster.webp'): File {
  const bytes = new Uint8Array(12);
  // "RIFF" at 0..3, "WEBP" at 8..11.
  [0x52, 0x49, 0x46, 0x46].forEach((b, i) => {
    bytes[i] = b;
  });
  [0x57, 0x45, 0x42, 0x50].forEach((b, i) => {
    bytes[8 + i] = b;
  });
  return new File([bytes], name, { type: 'image/webp' });
}

function posterFormData(
  options: { project_id?: string; file?: File | null } = {},
): FormData {
  const fd = new FormData();
  fd.append('project_id', options.project_id ?? projectId);
  if (options.file !== null) fd.append('file', options.file ?? jpegFile());
  return fd;
}

const posterPath = `${projectId}/poster-old.jpg`;

describe('setProjectVideoPoster', () => {
  it('sniffs a JPEG, uploads to the screenshots bucket, and points the row at it', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_poster_path: null },
      error: null,
    };

    const result = await setProjectVideoPoster(posterFormData());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.demo_video_poster_path).toMatch(
        new RegExp(`^${projectId}/poster-[0-9a-f-]+\\.jpg$`, 'i'),
      );
    }
    expect(authStorageFrom).toHaveBeenCalledWith('screenshots');
    // The poster lives in the screenshots bucket and must go through the
    // authenticated client, never the service-role one.
    expect(adminStorageFrom).not.toHaveBeenCalled();
    expect(storageUpload).toHaveBeenCalledTimes(1);
    expect(storageUpload.mock.calls[0]?.[2]).toMatchObject({
      contentType: 'image/jpeg',
      upsert: false,
    });
    expect(fromMock).toHaveBeenCalledWith('projects');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`);
  });

  it('removes the previous poster when replacing one', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_poster_path: posterPath },
      error: null,
    };

    const result = await setProjectVideoPoster(posterFormData());

    expect(result.success).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith([posterPath]);
  });

  it('accepts a PNG poster', async () => {
    const result = await setProjectVideoPoster(
      posterFormData({ file: pngFile() }),
    );

    expect(result.success).toBe(true);
    expect(storageUpload.mock.calls[0]?.[2]).toMatchObject({
      contentType: 'image/png',
    });
  });

  it('accepts a WebP poster', async () => {
    const result = await setProjectVideoPoster(
      posterFormData({ file: webpFile() }),
    );

    expect(result.success).toBe(true);
    expect(storageUpload.mock.calls[0]?.[2]).toMatchObject({
      contentType: 'image/webp',
    });
  });

  it('returns Unauthorized when there is no user', async () => {
    authGetUser.mockResolvedValue({ data: { user: null } });

    const result = await setProjectVideoPoster(posterFormData());

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the user is not the admin', async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: 'intruder', email: 'someone@else.com' } },
    });

    const result = await setProjectVideoPoster(posterFormData());

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid project id', async () => {
    const result = await setProjectVideoPoster(
      posterFormData({ project_id: 'nope' }),
    );

    expect(result.success).toBe(false);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('rejects when no file is supplied', async () => {
    const result = await setProjectVideoPoster(posterFormData({ file: null }));

    expect(result.success).toBe(false);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('rejects a file larger than 5MB', async () => {
    const big = jpegFile('big.jpg');
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });

    const result = await setProjectVideoPoster(posterFormData({ file: big }));

    expect(result.success).toBe(false);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('rejects bytes that are not a real image', async () => {
    const fake = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], 'x.jpg', {
      type: 'image/jpeg',
    });

    const result = await setProjectVideoPoster(posterFormData({ file: fake }));

    expect(result.success).toBe(false);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('returns a generic error when the storage upload fails', async () => {
    storageUpload.mockResolvedValue({
      data: null,
      error: { message: 'storage offline' },
    });

    const result = await setProjectVideoPoster(posterFormData());

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('compensates by removing the upload when the row update fails', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_poster_path: null },
      error: null,
    };
    projectsState.single = { data: null, error: { message: 'update boom' } };

    const result = await setProjectVideoPoster(posterFormData());

    expect(result.success).toBe(false);
    const uploadedPath = storageUpload.mock.calls[0]?.[0];
    expect(storageRemove).toHaveBeenCalledWith([uploadedPath]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('compensates and fails when the project does not exist (0-row update)', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_poster_path: null },
      error: null,
    };
    // A 0-row update surfaces from `.single()` as PGRST116.
    projectsState.single = {
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    };

    const result = await setProjectVideoPoster(posterFormData());

    expect(result.success).toBe(false);
    const uploadedPath = storageUpload.mock.calls[0]?.[0];
    expect(storageRemove).toHaveBeenCalledWith([uploadedPath]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when an Error is thrown mid-flight', async () => {
    authGetUser.mockRejectedValue(new Error('kaboom'));

    const result = await setProjectVideoPoster(posterFormData());

    expect(result).toEqual({
      success: false,
      error: 'Something went wrong. Please try again.',
    });
  });

  it('returns a generic error when a non-Error value is thrown', async () => {
    authGetUser.mockRejectedValue('string failure');

    const result = await setProjectVideoPoster(posterFormData());

    expect(result.success).toBe(false);
  });
});

describe('removeProjectVideoPoster', () => {
  it('clears the poster column and removes the file', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_poster_path: posterPath },
      error: null,
    };

    const result = await removeProjectVideoPoster({ projectId });

    expect(result).toEqual({ success: true, data: { projectId } });
    expect(authStorageFrom).toHaveBeenCalledWith('screenshots');
    expect(adminStorageFrom).not.toHaveBeenCalled();
    expect(storageRemove).toHaveBeenCalledWith([posterPath]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`);
  });

  it('succeeds without touching storage when there is no poster', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_poster_path: null },
      error: null,
    };

    const result = await removeProjectVideoPoster({ projectId });

    expect(result.success).toBe(true);
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid project id', async () => {
    const result = await removeProjectVideoPoster({ projectId: 'nope' });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns an error when the lookup fails', async () => {
    projectsState.maybeSingle = {
      data: null,
      error: { message: 'lookup boom' },
    };

    const result = await removeProjectVideoPoster({ projectId });

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns an error when nulling the column fails', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_poster_path: posterPath },
      error: null,
    };
    projectsState.single = { data: null, error: { message: 'update boom' } };

    const result = await removeProjectVideoPoster({ projectId });

    expect(result.success).toBe(false);
    expect(storageRemove).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns an error when the project does not exist (0-row update)', async () => {
    projectsState.maybeSingle = {
      data: { demo_video_poster_path: posterPath },
      error: null,
    };
    projectsState.single = {
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    };

    const result = await removeProjectVideoPoster({ projectId });

    expect(result.success).toBe(false);
    expect(storageRemove).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('removeProjectVideo (with poster)', () => {
  it('also removes the poster from the screenshots bucket', async () => {
    projectsState.maybeSingle = {
      data: {
        demo_video_path: storagePath,
        demo_video_poster_path: posterPath,
      },
      error: null,
    };

    const result = await removeProjectVideo({ projectId });

    expect(result.success).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith([storagePath]);
    expect(storageRemove).toHaveBeenCalledWith([posterPath]);
    // Security split: the video file is removed via the service-role client
    // (videos bucket), its poster via the authenticated client (screenshots).
    expect(adminStorageFrom).toHaveBeenCalledWith('videos');
    expect(authStorageFrom).toHaveBeenCalledWith('screenshots');
  });
});
