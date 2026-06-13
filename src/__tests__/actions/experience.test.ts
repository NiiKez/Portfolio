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

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: authGetUser },
    from: fromMock,
    rpc: rpcMock,
  })),
}));

import { revalidatePath } from 'next/cache';

import {
  createExperience,
  deleteExperience,
  reorderExperiences,
  updateExperience,
} from '@/actions/experience';

type SupabaseResult<T = unknown> = {
  data: T | null;
  // `code` mirrors the real supabase-js shape: a 0-row `.single()` resolves to
  // `{ data: null, error: { code: 'PGRST116' } }`.
  error: { message?: string; code?: string } | null;
};

type ChainState = {
  maybeSingle: SupabaseResult;
  single: SupabaseResult;
  terminal: SupabaseResult;
};

function createChain(state: ChainState) {
  const chain: Record<string, unknown> = {};
  for (const method of [
    'select',
    'insert',
    'update',
    'delete',
    'order',
    'limit',
    'eq',
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

let chainState: ChainState;

const validInput = {
  role: 'Software Engineer',
  company: 'Acme Corp',
  company_url: 'https://acme.example.com',
  location: 'Berlin, Germany',
  period: 'Jan 2024 – Dec 2024',
  kind: 'Full-time' as const,
  description: 'Built and shipped things.',
  technologies: ['TypeScript', 'React'],
};

beforeEach(() => {
  vi.clearAllMocks();
  chainState = {
    maybeSingle: { data: null, error: null },
    single: { data: null, error: null },
    terminal: { data: null, error: null },
  };
  fromMock.mockImplementation(() => createChain(chainState));
  rpcMock.mockResolvedValue({ data: null, error: null });
  authGetUser.mockResolvedValue({
    data: { user: { id: 'admin-uid', email: 'admin@example.com' } },
  });
});

describe('createExperience', () => {
  it('inserts an experience and revalidates public + admin surfaces', async () => {
    const inserted = {
      id: 'exp-id',
      ...validInput,
      company_url: validInput.company_url,
      location: validInput.location,
      sort_order: 3,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    chainState.maybeSingle = { data: { sort_order: 2 }, error: null };
    chainState.single = { data: inserted, error: null };

    const result = await createExperience(validInput);

    expect(result).toEqual({ success: true, data: inserted });
    expect(fromMock).toHaveBeenCalledWith('experiences');
    expect(revalidatePath).toHaveBeenCalledWith('/about');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/experience');
  });

  it('rejects an empty role without touching the database', async () => {
    const result = await createExperience({ ...validInput, role: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.toLowerCase()).toContain('role');
    }
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid kind value', async () => {
    const result = await createExperience({
      ...validInput,
      kind: 'Volunteer' as unknown as typeof validInput.kind,
    });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: 'intruder', email: 'someone@else.com' } },
    });

    const result = await createExperience(validInput);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error and logs when the insert fails', async () => {
    chainState.maybeSingle = { data: null, error: null };
    chainState.single = { data: null, error: { message: 'insert failed' } };

    const result = await createExperience(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Something went wrong. Please try again.');
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deleteExperience', () => {
  const validId = '11111111-1111-4111-8111-111111111111';

  it('deletes an experience for a valid uuid and revalidates surfaces', async () => {
    const result = await deleteExperience({ id: validId });

    expect(result).toEqual({ success: true, data: { id: validId } });
    expect(fromMock).toHaveBeenCalledWith('experiences');
    // The delete must be scoped by id — a dropped WHERE clause would wipe EVERY
    // experience row in real Postgres, which the mock only catches here.
    const chain = fromMock.mock.results[0]!.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(chain.eq).toHaveBeenCalledWith('id', validId);
    expect(revalidatePath).toHaveBeenCalledWith('/about');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/experience');
  });

  it('rejects a non-uuid id without touching the database', async () => {
    const result = await deleteExperience({ id: 'not-a-uuid' });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns an error when the underlying delete fails', async () => {
    chainState.terminal = { data: null, error: { message: 'db error' } };

    const result = await deleteExperience({ id: validId });

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({ data: { user: null } });

    const result = await deleteExperience({ id: validId });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('updateExperience', () => {
  const validId = '11111111-1111-4111-8111-111111111111';

  it('updates an experience for valid input and revalidates surfaces', async () => {
    const updated = {
      id: validId,
      ...validInput,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };
    chainState.single = { data: updated, error: null };

    const result = await updateExperience({ id: validId, ...validInput });

    expect(result).toEqual({ success: true, data: updated });
    expect(fromMock).toHaveBeenCalledWith('experiences');
    // The update must be scoped by id — a dropped WHERE clause would rewrite
    // EVERY experience row in real Postgres, which the mock only catches here.
    const chain = fromMock.mock.results[0]!.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(chain.eq).toHaveBeenCalledWith('id', validId);
    expect(revalidatePath).toHaveBeenCalledWith('/about');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/experience');
  });

  it('rejects a non-uuid id without touching the database', async () => {
    const result = await updateExperience({ id: 'not-a-uuid', ...validInput });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({ data: { user: null } });

    const result = await updateExperience({ id: validId, ...validInput });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when the update matches no row (PGRST116)', async () => {
    // supabase-js surfaces a 0-row `.single()` as a PGRST116 error.
    chainState.single = {
      data: null,
      error: { code: 'PGRST116', message: 'no rows returned' },
    };

    const result = await updateExperience({ id: validId, ...validInput });

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('never returns success with null data when the row is missing', async () => {
    // Belt-and-suspenders: if the 0-row contract ever changed to
    // `{ data: null, error: null }`, the action must still fail rather than
    // return `{ success: true, data: null }`.
    chainState.single = { data: null, error: null };

    const result = await updateExperience({ id: validId, ...validInput });

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('reorderExperiences', () => {
  const idA = '11111111-1111-4111-8111-111111111111';
  const idB = '22222222-2222-4222-8222-222222222222';

  it('updates sort_order for each item and revalidates surfaces', async () => {
    const result = await reorderExperiences([
      { id: idA, sort_order: 0 },
      { id: idB, sort_order: 1 },
    ]);

    expect(result).toEqual({ success: true, data: { count: 2 } });
    expect(rpcMock).toHaveBeenCalledWith('reorder_experiences', {
      items: [
        { id: idA, sort_order: 0 },
        { id: idB, sort_order: 1 },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/experience');
  });

  it('rejects items with non-uuid ids without touching the database', async () => {
    const result = await reorderExperiences([
      { id: 'not-a-uuid', sort_order: 0 },
    ]);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects items with a negative sort_order', async () => {
    const result = await reorderExperiences([{ id: idA, sort_order: -1 }]);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when the caller is not the admin', async () => {
    authGetUser.mockResolvedValue({ data: { user: null } });

    const result = await reorderExperiences([{ id: idA, sort_order: 0 }]);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when an update fails', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'db offline' },
    });

    const result = await reorderExperiences([{ id: idA, sort_order: 0 }]);

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
