import 'server-only';

import type { ReorderInput } from '@/lib/validations';

/**
 * Returns the distinct ids in a reorder payload. Throws if the payload contains
 * a duplicate id: reordering the same row to two positions at once is
 * ambiguous and signals a malformed or replayed client request, which must
 * fail loudly rather than be applied as a wholesale UPDATE.
 */
export function distinctReorderIds(items: ReorderInput): string[] {
  const ids = items.map((item) => item.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error('reorder: payload contains duplicate ids');
  }
  return [...unique];
}

/**
 * Asserts every requested id was found among the rows that actually exist.
 * The reorder RPCs run `UPDATE ... WHERE id = item.id` and return void, so a
 * payload referencing rows that no longer exist (a stale or replayed drag, or
 * ids belonging to another table/project) would touch zero of those rows yet
 * still report success. Failing here keeps the reported count honest.
 */
export function assertReorderIdsExist(
  requestedIds: readonly string[],
  foundIds: readonly string[],
): void {
  const found = new Set(foundIds);
  const missing = requestedIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new Error(
      `reorder: ${missing.length} of ${requestedIds.length} id(s) not found`,
    );
  }
}
