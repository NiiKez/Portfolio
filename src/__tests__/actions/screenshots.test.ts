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
const rpcMock = vi.fn();
const storageUpload = vi.fn();
const storageRemove = vi.fn();
const storageFrom = vi.fn(() => ({
  upload: storageUpload,
  remove: storageRemove,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: authGetUser },
    from: fromMock,
    rpc: rpcMock,
    storage: { from: storageFrom },
  })),
}));

import { revalidatePath } from 'next/cache';

import {
  deleteScreenshot,
  reorderScreenshots,
  uploadScreenshot,
} from '@/actions/screenshots';

type SupabaseResult<T = unknown> = {
  data: T | null;
  error: { message: string } | null;
};

type TableState = {
  maybeSingle: SupabaseResult;
  single: SupabaseResult;
  terminal: SupabaseResult;
};

function createChain(state: TableState) {
  const chain: Record<string, unknown> = {};
  for (const method of [
    'select',
    'insert',
    'update',
    'delete',
    'order',
    'limit',
    'eq',
    'in',
  ]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => state.maybeSingle);
  chain.single = vi.fn(async () => state.single);
  chain.then = (
    resolve: (value: SupabaseResult) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(state.terminal).then(resolve, reject);
  return chain;
}

const emptyState = (): TableState => ({
  maybeSingle: { data: null, error: null },
  single: { data: null, error: null },
  terminal: { data: null, error: null },
});

let tables: Record<'project_screenshots', TableState>;

beforeEach(() => {
  vi.clearAllMocks();
  tables = {
    project_screenshots: emptyState(),
  };
  fromMock.mockImplementation((name: 'project_screenshots') => {
    const state = tables[name] ?? emptyState();
    tables[name] = state;
    return createChain(state);
  });
  rpcMock.mockResolvedValue({ data: null, error: null });
  authGetUser.mockResolvedValue({
    data: { user: { id: 'admin-uid', email: 'admin@example.com' } },
  });
  storageUpload.mockResolvedValue({ data: { path: 'x' }, error: null });
  storageRemove.mockResolvedValue({ data: null, error: null });
});

const projectId = '11111111-1111-4111-8111-111111111111';
const screenshotId = '22222222-2222-4222-8222-222222222222';
const screenshotId2 = '33333333-3333-4333-8333-333333333333';

// First bytes of valid image signatures used to construct File fixtures.
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngFile(name = 'shot.png'): File {
  return new File([new Uint8Array(PNG_SIG)], name, { type: 'image/png' });
}

const JPEG_SIG = [0xff, 0xd8, 0xff];

function jpegFile(name = 'shot.jpg'): File {
  return new File([new Uint8Array(JPEG_SIG)], name, { type: 'image/jpeg' });
}

function webpFile(name = 'shot.webp'): File {
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

function makeFormData(
  options: {
    project_id?: string;
    alt_text?: string;
    file?: File | null;
  } = {},
): FormData {
  const fd = new FormData();
  fd.append('project_id', options.project_id ?? projectId);
  if (options.alt_text !== undefined) fd.append('alt_text', options.alt_text);
  if (options.file !== null) fd.append('file', options.file ?? pngFile());
  return fd;
}

const savedScreenshot = {
  id: screenshotId,
  project_id: projectId,
  storage_path: `${projectId}/abc.png`,
  alt_text: 'Dashboard view',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
};

describe('uploadScreenshot', () => {
  it('uploads the file, inserts a row, and revalidates surfaces', async () => {
    tables.project_screenshots.maybeSingle = {
      data: { sort_order: 2 },
      error: null,
    };
    tables.project_screenshots.single = {
      data: { ...savedScreenshot, sort_order: 3 },
      error: null,
    };

    const result = await uploadScreenshot(
      makeFormData({ alt_text: 'Dashboard view' }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort_order).toBe(3);
    }
    expect(storageFrom).toHaveBeenCalledWith('screenshots');
    expect(storageUpload).toHaveBeenCalledTimes(1);
    const uploadCall = storageUpload.mock.calls[0];
    expect(uploadCall?.[0]).toMatch(new RegExp(`^${projectId}/.+\\.png$`));
    expect(uploadCall?.[2]).toMatchObject({
      contentType: 'image/png',
      upsert: false,
    });
    expect(fromMock).toHaveBeenCalledWith('project_screenshots');
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/projects/${projectId}`);
  });

  it('defaults sort_order to 0 when the project has no existing screenshots', async () => {
    tables.project_screenshots.maybeSingle = { data: null, error: null };
    tables.project_screenshots.single = { data: savedScreenshot, error: null };

    const result = await uploadScreenshot(makeFormData());

    expect(result.success).toBe(true);
  });

  it('accepts a JPEG file by sniffing its magic bytes', async () => {
    tables.project_screenshots.maybeSingle = { data: null, error: null };
    tables.project_screenshots.single = { data: savedScreenshot, error: null };

    const result = await uploadScreenshot(makeFormData({ file: jpegFile() }));

    expect(result.success).toBe(true);
    expect(storageUpload.mock.calls[0]?.[2]).toMatchObject({
      contentType: 'image/jpeg',
    });
    expect(storageUpload.mock.calls[0]?.[0]).toMatch(
      new RegExp(`^${projectId}/.+\\.jpg$`),
    );
  });

  it('accepts a WebP file by sniffing its magic bytes', async () => {
    tables.project_screenshots.maybeSingle = { data: null, error: null };
    tables.project_screenshots.single = { data: savedScreenshot, error: null };

    const result = await uploadScreenshot(makeFormData({ file: webpFile() }));

    expect(result.success).toBe(true);
    expect(storageUpload.mock.calls[0]?.[2]).toMatchObject({
      contentType: 'image/webp',
    });
  });

  it('removes the uploaded file when reading the max sort_order fails', async () => {
    tables.project_screenshots.maybeSingle = {
      data: null,
      error: { message: 'read boom' },
    };

    const result = await uploadScreenshot(makeFormData());

    expect(result.success).toBe(false);
    const uploadedPath = storageUpload.mock.calls[0]?.[0];
    expect(storageRemove).toHaveBeenCalledWith([uploadedPath]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid project_id before uploading', async () => {
    const result = await uploadScreenshot(
      makeFormData({ project_id: 'not-a-uuid' }),
    );

    expect(result.success).toBe(false);
    expect(storageUpload).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an alt_text longer than 200 characters', async () => {
    const result = await uploadScreenshot(
      makeFormData({ alt_text: 'a'.repeat(201) }),
    );

    expect(result.success).toBe(false);
    expect(storageUpload).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects when no file is supplied', async () => {
    const result = await uploadScreenshot(makeFormData({ file: null }));

    expect(result.success).toBe(false);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('rejects a file larger than 5MB', async () => {
    const big = new File([new Uint8Array(PNG_SIG)], 'big.png', {
      type: 'image/png',
    });
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });

    const result = await uploadScreenshot(makeFormData({ file: big }));

    expect(result.success).toBe(false);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('rejects a file whose bytes are not a real image even if it claims to be a png', async () => {
    const fake = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], 'x.png', {
      type: 'image/png',
    });

    const result = await uploadScreenshot(makeFormData({ file: fake }));

    expect(result.success).toBe(false);
    expect(storageUpload).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: 'intruder', email: 'someone@else.com' } },
    });

    const result = await uploadScreenshot(makeFormData());

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(storageUpload).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns a generic error when the storage upload fails', async () => {
    storageUpload.mockResolvedValue({
      data: null,
      error: { message: 'storage offline' },
    });

    const result = await uploadScreenshot(makeFormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Something went wrong. Please try again.');
    }
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('removes the uploaded file when the row insert fails (compensation)', async () => {
    tables.project_screenshots.maybeSingle = { data: null, error: null };
    tables.project_screenshots.single = {
      data: null,
      error: { message: 'constraint violation' },
    };

    const result = await uploadScreenshot(makeFormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Something went wrong. Please try again.');
    }
    const uploadedPath = storageUpload.mock.calls[0]?.[0];
    expect(storageRemove).toHaveBeenCalledWith([uploadedPath]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deleteScreenshot', () => {
  it('deletes the row first, removes the storage file, and revalidates surfaces', async () => {
    tables.project_screenshots.single = {
      data: { project_id: projectId, storage_path: `${projectId}/abc.png` },
      error: null,
    };

    const result = await deleteScreenshot({ id: screenshotId });

    expect(result).toEqual({ success: true, data: { id: screenshotId } });
    expect(fromMock).toHaveBeenCalledWith('project_screenshots');
    expect(storageFrom).toHaveBeenCalledWith('screenshots');
    expect(storageRemove).toHaveBeenCalledWith([`${projectId}/abc.png`]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/projects/${projectId}`);
  });

  it('rejects a non-uuid id without touching the database', async () => {
    const result = await deleteScreenshot({ id: 'not-a-uuid' });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({ data: { user: null } });

    const result = await deleteScreenshot({ id: screenshotId });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns a generic error when the row lookup fails', async () => {
    tables.project_screenshots.single = {
      data: null,
      error: { message: 'row not found' },
    };

    const result = await deleteScreenshot({ id: screenshotId });

    expect(result.success).toBe(false);
    expect(storageRemove).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('still succeeds (row already deleted) when storage removal fails', async () => {
    tables.project_screenshots.single = {
      data: { project_id: projectId, storage_path: `${projectId}/abc.png` },
      error: null,
    };
    storageRemove.mockRejectedValue(new Error('storage offline'));

    const result = await deleteScreenshot({ id: screenshotId });

    expect(result.success).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith([`${projectId}/abc.png`]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`);
  });

  it('skips storage removal when the stored path is empty', async () => {
    tables.project_screenshots.single = {
      data: { project_id: projectId, storage_path: '' },
      error: null,
    };

    const result = await deleteScreenshot({ id: screenshotId });

    expect(result.success).toBe(true);
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('returns a generic error when the row delete fails and skips storage removal', async () => {
    tables.project_screenshots.single = {
      data: { project_id: projectId, storage_path: `${projectId}/abc.png` },
      error: null,
    };
    tables.project_screenshots.terminal = {
      data: null,
      error: { message: 'delete blocked' },
    };

    const result = await deleteScreenshot({ id: screenshotId });

    expect(result.success).toBe(false);
    expect(storageRemove).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('reorderScreenshots', () => {
  it('updates sort_order for each item and revalidates surfaces per project', async () => {
    tables.project_screenshots.terminal = {
      data: [
        { id: screenshotId, project_id: projectId },
        { id: screenshotId2, project_id: projectId },
      ],
      error: null,
    };

    const result = await reorderScreenshots([
      { id: screenshotId, sort_order: 0 },
      { id: screenshotId2, sort_order: 1 },
    ]);

    expect(result).toEqual({ success: true, data: { count: 2 } });
    expect(fromMock).toHaveBeenCalledWith('project_screenshots');
    expect(rpcMock).toHaveBeenCalledWith('reorder_project_screenshots', {
      items: [
        { id: screenshotId, sort_order: 0 },
        { id: screenshotId2, sort_order: 1 },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`);
  });

  it('rejects items with non-uuid ids', async () => {
    const result = await reorderScreenshots([
      { id: 'not-a-uuid', sort_order: 0 },
    ]);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects items with a negative sort_order', async () => {
    const result = await reorderScreenshots([
      { id: screenshotId, sort_order: -1 },
    ]);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns an error when the initial row lookup fails', async () => {
    tables.project_screenshots.terminal = {
      data: null,
      error: { message: 'select failed' },
    };

    const result = await reorderScreenshots([
      { id: screenshotId, sort_order: 0 },
    ]);

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
