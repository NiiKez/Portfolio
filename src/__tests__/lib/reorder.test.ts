import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { assertReorderIdsExist, distinctReorderIds } from '@/lib/reorder';

const idA = '11111111-1111-4111-8111-111111111111';
const idB = '22222222-2222-4222-8222-222222222222';
const idC = '33333333-3333-4333-8333-333333333333';

describe('distinctReorderIds', () => {
  it('returns the distinct ids for a clean payload', () => {
    const ids = distinctReorderIds([
      { id: idA, sort_order: 0 },
      { id: idB, sort_order: 1 },
    ]);

    expect(ids).toEqual([idA, idB]);
  });

  it('returns an empty array for an empty payload', () => {
    expect(distinctReorderIds([])).toEqual([]);
  });

  it('throws when the payload contains a duplicate id', () => {
    expect(() =>
      distinctReorderIds([
        { id: idA, sort_order: 0 },
        { id: idA, sort_order: 1 },
      ]),
    ).toThrow(/duplicate/i);
  });
});

describe('assertReorderIdsExist', () => {
  it('does nothing when every requested id was found', () => {
    expect(() =>
      assertReorderIdsExist([idA, idB], [idA, idB, idC]),
    ).not.toThrow();
  });

  it('does nothing for the empty requested-id case', () => {
    expect(() => assertReorderIdsExist([], [])).not.toThrow();
    expect(() => assertReorderIdsExist([], [idA])).not.toThrow();
  });

  it('throws when a requested id is missing', () => {
    expect(() => assertReorderIdsExist([idA, idB], [idA])).toThrow(
      /not found/i,
    );
  });

  it('throws when several requested ids are missing', () => {
    expect(() => assertReorderIdsExist([idA, idB, idC], [])).toThrow(
      /3 of 3 id\(s\) not found/,
    );
  });
});
