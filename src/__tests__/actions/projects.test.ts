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
// SECURITY CONTRACT: the admin-only `videos` bucket must be cleaned up through
// the service-role client (createAdminClient) — mirroring `removeProjectVideo`
// in actions/videos.ts — while the `screenshots` bucket goes through the
// authenticated client (createClient). Two *distinct* `from` spies let a test
// prove that routing so a regression swapping the clients fails loudly.
const storageRemove = vi.fn();
const storageFrom = vi.fn(() => ({ remove: storageRemove }));
const adminStorageRemove = vi.fn();
const adminStorageFrom = vi.fn(() => ({ remove: adminStorageRemove }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: authGetUser },
    from: fromMock,
    rpc: rpcMock,
    storage: { from: storageFrom },
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: { from: adminStorageFrom },
  })),
}));

import { revalidatePath } from 'next/cache';

import {
  createProject,
  deleteProject,
  reorderProjects,
  updateProject,
} from '@/actions/projects';

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

type TableName = 'projects' | 'project_technologies' | 'project_screenshots';

let tables: Record<TableName, TableState>;

beforeEach(() => {
  vi.clearAllMocks();
  tables = {
    projects: emptyState(),
    project_technologies: emptyState(),
    project_screenshots: emptyState(),
  };
  fromMock.mockImplementation((name: TableName) => {
    const state = tables[name] ?? emptyState();
    tables[name] = state;
    return createChain(state);
  });
  rpcMock.mockResolvedValue({ data: null, error: null });
  authGetUser.mockResolvedValue({
    data: { user: { id: 'admin-uid', email: 'admin@example.com' } },
  });
  storageRemove.mockResolvedValue({ data: null, error: null });
  adminStorageRemove.mockResolvedValue({ data: null, error: null });
});

const validUuid1 = '11111111-1111-4111-8111-111111111111';
const validUuid2 = '22222222-2222-4222-8222-222222222222';

const insertedProject = {
  id: validUuid1,
  title: 'Portfolio',
  description: 'A portfolio site',
  github_url: 'https://github.com/me/portfolio',
  sort_order: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('createProject', () => {
  it('inserts a project with technology links and revalidates surfaces', async () => {
    tables.projects.maybeSingle = { data: { sort_order: 0 }, error: null };
    tables.projects.single = { data: insertedProject, error: null };

    const result = await createProject({
      title: 'Portfolio',
      description: 'A portfolio site',
      github_url: 'https://github.com/me/portfolio',
      technology_ids: [validUuid2],
    });

    expect(result).toEqual({ success: true, data: insertedProject });
    expect(fromMock).toHaveBeenCalledWith('projects');
    expect(fromMock).toHaveBeenCalledWith('project_technologies');
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/projects');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${validUuid1}`);
    expect(revalidatePath).toHaveBeenCalledWith(
      `/admin/projects/${validUuid1}`,
    );
  });

  it('skips the technology insert when technology_ids is empty', async () => {
    tables.projects.maybeSingle = { data: null, error: null };
    tables.projects.single = { data: insertedProject, error: null };

    const result = await createProject({
      title: 'Portfolio',
      description: 'A portfolio site',
      github_url: '',
      technology_ids: [],
    });

    expect(result.success).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('projects');
    expect(fromMock).not.toHaveBeenCalledWith('project_technologies');
  });

  it('rejects an empty title without touching the database', async () => {
    const result = await createProject({
      title: '',
      description: 'A portfolio site',
      github_url: '',
      technology_ids: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.toLowerCase()).toContain('title');
    }
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a malformed github_url', async () => {
    const result = await createProject({
      title: 'Portfolio',
      description: 'A portfolio site',
      github_url: 'not-a-url',
      technology_ids: [],
    });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects non-uuid values in technology_ids', async () => {
    const result = await createProject({
      title: 'Portfolio',
      description: 'A portfolio site',
      github_url: '',
      technology_ids: ['not-a-uuid'],
    });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: 'intruder', email: 'someone@else.com' } },
    });

    const result = await createProject({
      title: 'Portfolio',
      description: 'A portfolio site',
      github_url: '',
      technology_ids: [],
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error and logs when the project insert fails', async () => {
    tables.projects.maybeSingle = { data: null, error: null };
    tables.projects.single = {
      data: null,
      error: { message: 'constraint violation' },
    };

    const result = await createProject({
      title: 'Portfolio',
      description: 'A portfolio site',
      github_url: '',
      technology_ids: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Something went wrong. Please try again.');
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('deletes the just-created project when linking technologies fails (compensation)', async () => {
    tables.projects.maybeSingle = { data: { sort_order: 0 }, error: null };
    tables.projects.single = { data: insertedProject, error: null };
    tables.project_technologies.terminal = {
      data: null,
      error: { message: 'fk violation' },
    };

    const projectsChain = createChain(tables.projects);
    const projectsDelete = projectsChain.delete as ReturnType<typeof vi.fn>;
    fromMock.mockImplementation((name: TableName) => {
      if (name === 'projects') return projectsChain;
      const state = tables[name] ?? emptyState();
      tables[name] = state;
      return createChain(state);
    });

    const result = await createProject({
      title: 'Portfolio',
      description: 'A portfolio site',
      github_url: '',
      technology_ids: [validUuid2],
    });

    expect(result.success).toBe(false);
    // Compensation: the orphaned project row is removed.
    expect(projectsDelete).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('updateProject', () => {
  it('updates a project, replaces technology links, and revalidates', async () => {
    rpcMock.mockResolvedValue({ data: insertedProject, error: null });

    const result = await updateProject({
      id: validUuid1,
      title: 'Portfolio v2',
      description: 'Updated description',
      github_url: '',
      technology_ids: [validUuid2],
    });

    expect(result.success).toBe(true);
    // The row update + link replacement happen atomically in one RPC.
    expect(rpcMock).toHaveBeenCalledWith('update_project_with_techs', {
      p_id: validUuid1,
      p_title: 'Portfolio v2',
      p_description: 'Updated description',
      p_github_url: null,
      p_live_url: null,
      p_technology_ids: [validUuid2],
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${validUuid1}`);
    expect(revalidatePath).toHaveBeenCalledWith(
      `/admin/projects/${validUuid1}`,
    );
  });

  it('rejects a non-uuid id without touching the database', async () => {
    const result = await updateProject({
      id: 'not-a-uuid',
      title: 'Portfolio',
      description: 'desc',
      github_url: '',
      technology_ids: [],
    });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: 'intruder', email: 'someone@else.com' } },
    });

    const result = await updateProject({
      id: validUuid1,
      title: 'Portfolio',
      description: 'desc',
      github_url: '',
      technology_ids: [validUuid2],
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    // The write goes through an RPC and revalidation — both must be skipped.
    expect(rpcMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('dedupes technology_ids so a duplicate skill cannot violate the PK', async () => {
    // A duplicate skill id would otherwise hit project_technologies
    // PK(project_id, skill_id) and roll back the whole atomic RPC.
    rpcMock.mockResolvedValue({ data: insertedProject, error: null });

    const result = await updateProject({
      id: validUuid1,
      title: 'Portfolio',
      description: 'desc',
      github_url: '',
      technology_ids: [validUuid2, validUuid2, validUuid2],
    });

    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      'update_project_with_techs',
      expect.objectContaining({ p_technology_ids: [validUuid2] }),
    );
  });

  it('returns an error when the update RPC fails', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'row not found' },
    });

    const result = await updateProject({
      id: validUuid1,
      title: 'Portfolio',
      description: 'desc',
      github_url: '',
      technology_ids: [],
    });

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('surfaces an error and revalidates nothing when the atomic RPC rolls back', async () => {
    // The update + link replacement is one transaction now: a failure (e.g. a
    // bad skill_id FK) rolls the whole thing back, so there is no partial state
    // and no compensation logic to exercise — just a surfaced error.
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'insert failed' },
    });

    const result = await updateProject({
      id: validUuid1,
      title: 'Portfolio',
      description: 'desc',
      github_url: '',
      technology_ids: [validUuid1],
    });

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deleteProject', () => {
  it('deletes a project and revalidates surfaces', async () => {
    // Use a single shared projects chain so the `.eq('id', ...)` filter on the
    // delete is observable — without it the delete would hit EVERY row in real
    // Postgres, which the per-call fresh chains otherwise cannot catch.
    const projectsChain = createChain(tables.projects);
    fromMock.mockImplementation((name: TableName) => {
      if (name === 'projects') return projectsChain;
      const state = tables[name] ?? emptyState();
      tables[name] = state;
      return createChain(state);
    });

    const result = await deleteProject({ id: validUuid1 });

    expect(result).toEqual({ success: true, data: { id: validUuid1 } });
    expect(fromMock).toHaveBeenCalledWith('project_screenshots');
    expect(fromMock).toHaveBeenCalledWith('projects');
    // The delete must be scoped by id — a dropped WHERE clause would wipe every row.
    expect(projectsChain.eq).toHaveBeenCalledWith('id', validUuid1);
    expect(storageFrom).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('removes storage files for all screenshots after deleting the row', async () => {
    tables.project_screenshots.terminal = {
      data: [
        { storage_path: `${validUuid1}/a.png` },
        { storage_path: `${validUuid1}/b.png` },
      ],
      error: null,
    };

    const result = await deleteProject({ id: validUuid1 });

    expect(result.success).toBe(true);
    expect(storageFrom).toHaveBeenCalledWith('screenshots');
    expect(storageRemove).toHaveBeenCalledWith([
      `${validUuid1}/a.png`,
      `${validUuid1}/b.png`,
    ]);
  });

  it('removes the demo video from the videos bucket via the service-role client', async () => {
    tables.projects.maybeSingle = {
      data: { demo_video_path: `${validUuid1}/demo.mp4` },
      error: null,
    };

    const result = await deleteProject({ id: validUuid1 });

    expect(result.success).toBe(true);
    // SECURITY CONTRACT: the videos bucket delete must go through the
    // service-role client, NOT the authenticated client — otherwise an RLS
    // denial would silently orphan the demo video.
    expect(adminStorageFrom).toHaveBeenCalledWith('videos');
    expect(adminStorageRemove).toHaveBeenCalledWith([`${validUuid1}/demo.mp4`]);
    // The authenticated client must never touch the videos bucket here.
    expect(storageFrom).not.toHaveBeenCalledWith('videos');
  });

  it('removes the poster from the screenshots bucket via the authenticated client', async () => {
    tables.projects.maybeSingle = {
      data: {
        demo_video_path: null,
        demo_video_poster_path: `${validUuid1}/poster.jpg`,
      },
      error: null,
    };

    const result = await deleteProject({ id: validUuid1 });

    expect(result.success).toBe(true);
    // The poster lives in the screenshots bucket, which the authenticated
    // client can write to — it must NOT go through the service-role client.
    expect(storageFrom).toHaveBeenCalledWith('screenshots');
    expect(storageRemove).toHaveBeenCalledWith([`${validUuid1}/poster.jpg`]);
    expect(adminStorageFrom).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid id without touching the database', async () => {
    const result = await deleteProject({ id: 'not-a-uuid' });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({ data: { user: null } });

    const result = await deleteProject({ id: validUuid1 });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns an error when fetching screenshot paths fails', async () => {
    tables.project_screenshots.terminal = {
      data: null,
      error: { message: 'select failed' },
    };

    const result = await deleteProject({ id: validUuid1 });

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('still succeeds (row already deleted) when storage removal fails', async () => {
    tables.project_screenshots.terminal = {
      data: [{ storage_path: `${validUuid1}/a.png` }],
      error: null,
    };
    storageRemove.mockRejectedValue(new Error('storage down'));

    const result = await deleteProject({ id: validUuid1 });

    expect(result.success).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith([`${validUuid1}/a.png`]);
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('returns an error when the project row delete fails', async () => {
    tables.projects.terminal = {
      data: null,
      error: { message: 'delete blocked' },
    };

    const result = await deleteProject({ id: validUuid1 });

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('reorderProjects', () => {
  it('updates sort_order for each item and revalidates surfaces', async () => {
    tables.projects.terminal = {
      data: [{ id: validUuid1 }, { id: validUuid2 }],
      error: null,
    };

    const result = await reorderProjects([
      { id: validUuid1, sort_order: 0 },
      { id: validUuid2, sort_order: 1 },
    ]);

    expect(result).toEqual({ success: true, data: { count: 2 } });
    expect(rpcMock).toHaveBeenCalledWith('reorder_projects', {
      items: [
        { id: validUuid1, sort_order: 0 },
        { id: validUuid2, sort_order: 1 },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/projects');
  });

  it('fails without calling the RPC when a requested id does not exist', async () => {
    // Only validUuid1 exists; validUuid2 is a stale/unknown id. The existence
    // check must fail BEFORE the wholesale UPDATE rather than report success.
    tables.projects.terminal = { data: [{ id: validUuid1 }], error: null };

    const result = await reorderProjects([
      { id: validUuid1, sort_order: 0 },
      { id: validUuid2, sort_order: 1 },
    ]);

    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a duplicate-id payload before any database call', async () => {
    const result = await reorderProjects([
      { id: validUuid1, sort_order: 0 },
      { id: validUuid1, sort_order: 1 },
    ]);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects items with non-uuid ids', async () => {
    const result = await reorderProjects([{ id: 'not-a-uuid', sort_order: 0 }]);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects items with a negative sort_order', async () => {
    const result = await reorderProjects([{ id: validUuid1, sort_order: -1 }]);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: 'intruder', email: 'someone@else.com' } },
    });

    const result = await reorderProjects([{ id: validUuid1, sort_order: 0 }]);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns an error when the reorder RPC fails', async () => {
    tables.projects.terminal = { data: [{ id: validUuid1 }], error: null };
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'row locked' },
    });

    const result = await reorderProjects([{ id: validUuid1, sort_order: 0 }]);

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
