import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const fromMock = vi.fn();

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

import { getExperiences } from '@/lib/queries/experience';

type SupabaseResult = {
  data: unknown;
  error: { message: string } | null;
};

// Chain: .select().order().order() — the second .order() is terminal.
function createListChain(result: SupabaseResult) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  let orderCalls = 0;
  chain.order = vi.fn(() => {
    orderCalls += 1;
    return orderCalls >= 2 ? Promise.resolve(result) : chain;
  });
  return chain;
}

const baseRow = {
  id: 'e1',
  company: 'Acme',
  role: 'Engineer',
  description: null,
  start_date: '2024-01-01',
  end_date: null,
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getExperiences', () => {
  it('returns the rows ordered from the experiences table', async () => {
    const rows = [baseRow, { ...baseRow, id: 'e2', sort_order: 1 }];
    fromMock.mockReturnValue(createListChain({ data: rows, error: null }));

    const result = await getExperiences();

    expect(fromMock).toHaveBeenCalledWith('experiences');
    expect(result).toEqual(rows);
  });

  it('returns an empty array when data is null', async () => {
    fromMock.mockReturnValue(createListChain({ data: null, error: null }));

    const result = await getExperiences();

    expect(result).toEqual([]);
  });

  it('throws when supabase returns an error', async () => {
    fromMock.mockReturnValue(
      createListChain({ data: null, error: { message: 'boom' } }),
    );

    await expect(getExperiences()).rejects.toEqual({ message: 'boom' });
  });
});
